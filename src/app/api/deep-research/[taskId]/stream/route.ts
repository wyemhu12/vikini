// /app/api/deep-research/[taskId]/stream/route.ts
// SSE endpoint that polls Gemini server-side and forwards events to the client.
// Replaces the client-side polling approach with a real-time stream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro: standard limit 800s. Deep Research can take 3-10 minutes,
// so 800s covers the vast majority of sessions without hitting Vercel limits.
export const maxDuration = 800;

import { type NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { checkResearchStatus } from "@/lib/features/research/researchService.server";
import { UnauthorizedError, AppError, ValidationError } from "@/lib/utils/errors";
import { UUID_REGEX } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";
import type { ResearchTask } from "@/lib/features/research/types";

const streamLogger = logger.withContext("/api/deep-research/[taskId]/stream");

/** Server-side poll interval - faster than client-side since there's no network overhead per poll */
const POLL_INTERVAL_PLANNING_MS = 2_000;
const POLL_INTERVAL_EXECUTING_MS = 5_000;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes max (internal safety net)

/**
 * If the Gemini agent stays at in_progress without producing any real steps
 * (i.e. only the echo `user_input` step) for longer than this threshold,
 * we consider it a "silent hang" and auto-retry with a new interaction.
 * This is a known intermittent issue with the Deep Research API.
 */
const STALE_THRESHOLD_MS = 90 * 1000; // 90 seconds before considering stale (reduced from 3 min for faster recovery)
const MAX_STALE_RETRIES = 3; // Max auto-retries before giving up

/**
 * GET /api/deep-research/[taskId]/stream
 *
 * Returns an SSE (Server-Sent Events) stream that forwards research progress
 * in real-time. The server polls Gemini every 2-5 seconds and pushes events
 * to the client, eliminating the need for client-side polling.
 *
 * Events:
 * - `task`: Updated task state (JSON)
 * - `complete`: Final task state (JSON), stream ends after
 * - `stream_error`: Error message (JSON) - named to avoid collision with EventSource connection errors
 * - `ping`: Keep-alive (every 15s)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const { taskId } = await params;

    if (!taskId || !UUID_REGEX.test(taskId)) {
      throw new ValidationError("Invalid task ID");
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const startTime = Date.now();

    // Shared flag - set to false by abort signal, cancel(), or internal exit conditions
    let running = true;

    const stream = new ReadableStream({
      async start(controller) {
        let lastStatus = "";
        let consecutiveErrors = 0;
        // Track when we first saw the agent with no real steps (stale detection)
        let noStepsSince: number | null = null;
        let staleRetries = 0;

        const sendEvent = (event: string, data: unknown) => {
          try {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(payload));
          } catch {
            // Controller may be closed
            running = false;
          }
        };

        const sendPing = () => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            running = false;
          }
        };

        // Keep-alive ping every 15 seconds
        const pingInterval = setInterval(() => {
          if (!running) {
            clearInterval(pingInterval);
            return;
          }
          sendPing();
        }, 15_000);

        // Listen for client disconnect via AbortSignal
        const onAbort = () => {
          streamLogger.info(`Client disconnected for task ${taskId}`);
          running = false;
        };
        req.signal.addEventListener("abort", onAbort);

        try {
          while (running) {
            // Check timeout
            if (Date.now() - startTime > MAX_DURATION_MS) {
              sendEvent("stream_error", { message: "Stream timed out after 30 minutes" });
              break;
            }

            try {
              const task: ResearchTask = await checkResearchStatus(userId, taskId);
              consecutiveErrors = 0;

              // Only send update if status or key fields changed
              const taskFingerprint = `${task.status}:${task.currentStep || ""}:${task.searchedSources?.length || 0}:${(task.thinkingText || "").length}`;
              if (taskFingerprint !== lastStatus) {
                lastStatus = taskFingerprint;
                sendEvent("task", { task });
              }

              // Stale detection: if agent has no real steps for too long,
              // it's likely a "silent hang" - a known Gemini Deep Research issue.
              // Strategy: auto-retry with a new interaction before giving up.
              if (!task.currentStep) {
                if (noStepsSince === null) noStepsSince = Date.now();
                if (Date.now() - noStepsSince > STALE_THRESHOLD_MS) {
                  staleRetries++;
                  streamLogger.warn(
                    `Stale detection triggered for task ${taskId} (retry ${staleRetries}/${MAX_STALE_RETRIES})`
                  );

                  if (staleRetries > MAX_STALE_RETRIES) {
                    // Give up after max retries
                    const staleMsg =
                      "Research agent failed to start after multiple attempts (Gemini silent hang). " +
                      "This is a known intermittent issue. Please try again later.";
                    const { getSupabaseAdmin } = await import("@/lib/core/supabase.server");
                    await getSupabaseAdmin()
                      .from("research_tasks")
                      .update({ status: "failed", error_message: staleMsg })
                      .eq("id", taskId);

                    // Save prompt + error to conversation so the user's query is preserved
                    try {
                      const { finalizeResearch } =
                        await import("@/lib/features/research/researchService.server");
                      await finalizeResearch(
                        { ...task, status: "failed" as const, errorMessage: staleMsg },
                        `*Deep Research Failed*\n\nReason: ${staleMsg}`,
                        true
                      );
                    } catch (finErr: unknown) {
                      streamLogger.warn(
                        "Failed to save stale-failed research to conversation:",
                        finErr instanceof Error ? finErr.message : "Unknown error"
                      );
                    }

                    sendEvent("complete", {
                      task: { ...task, status: "failed", errorMessage: staleMsg },
                    });
                    break;
                  }

                  // Auto-retry: create a new interaction and update the task
                  try {
                    const { createResearchInteraction } = await import("@/lib/core/genaiClient");
                    const { getSupabaseAdmin } = await import("@/lib/core/supabase.server");
                    const supabase = getSupabaseAdmin();

                    const isPlanning = task.status === "planning";
                    const newInteraction = await createResearchInteraction({
                      input: isPlanning ? task.query : "Proceed with the research plan.",
                      agent: task.agentModel,
                      collaborativePlanning: isPlanning,
                      previousInteractionId: isPlanning
                        ? undefined
                        : task.planInteractionId || undefined,
                    });

                    // Update DB with new interaction ID
                    const updateField = isPlanning
                      ? { plan_interaction_id: newInteraction.id }
                      : { exec_interaction_id: newInteraction.id };
                    await supabase.from("research_tasks").update(updateField).eq("id", taskId);

                    streamLogger.info(
                      `Stale retry: created new interaction ${newInteraction.id} for task ${taskId}`
                    );
                    sendEvent("task", {
                      task: {
                        ...task,
                        thinkingText:
                          `_⟳ Retrying... (attempt ${staleRetries + 1}/${MAX_STALE_RETRIES + 1})_\n\n` +
                          `_The research agent didn't start in time. Creating a new session - please wait ~90s..._\n\n`,
                      },
                    });

                    // Reset stale timer for the new interaction
                    noStepsSince = Date.now();
                    lastStatus = ""; // Force next update to be sent
                  } catch (retryErr: unknown) {
                    const retryMsg =
                      retryErr instanceof Error ? retryErr.message : "Unknown retry error";
                    streamLogger.error(`Stale retry failed: ${retryMsg}`);
                    // Continue polling - next stale cycle will try again or give up
                    noStepsSince = Date.now();
                  }
                }
              } else {
                // Agent started working - reset stale timer and retry counter
                noStepsSince = null;
                staleRetries = 0;
              }

              // Terminal state - send final event and close.
              // `ready_to_execute` is also terminal for the SSE stream: planning is done,
              // the plan is shown to the user for approval. When they click "Start Research",
              // a NEW SSE connection is opened for the executing phase.
              // Without this, the planning SSE would keep polling indefinitely, and the
              // new executing SSE would create a second parallel stream - causing duplicate
              // stale detection, duplicate retries, and race conditions.
              if (
                task.status === "completed" ||
                task.status === "failed" ||
                task.status === "ready_to_execute"
              ) {
                sendEvent("complete", { task });
                break;
              }

              // Adaptive delay
              const delay =
                task.status === "planning" ? POLL_INTERVAL_PLANNING_MS : POLL_INTERVAL_EXECUTING_MS;

              await new Promise<void>((resolve) => {
                const timer = setTimeout(() => resolve(), delay);
                // If the controller is closed (client disconnected), clean up
                if (!running) {
                  clearTimeout(timer);
                  resolve();
                }
              });
            } catch (pollErr: unknown) {
              consecutiveErrors++;
              const errMsg = pollErr instanceof Error ? pollErr.message : "Unknown poll error";
              streamLogger.warn(`Poll error (${consecutiveErrors}/5):`, errMsg);

              if (consecutiveErrors >= 5) {
                sendEvent("stream_error", {
                  message: `Polling stopped after 5 consecutive errors: ${errMsg}`,
                });
                break;
              }

              // Wait before retrying on error
              await new Promise<void>((resolve) => setTimeout(resolve, 3000));
            }
          }
        } finally {
          running = false;
          clearInterval(pingInterval);
          req.signal.removeEventListener("abort", onAbort);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },

      cancel() {
        // Client disconnected - stop the poll loop
        streamLogger.info(`SSE stream cancelled for task ${taskId}`);
        running = false;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (err: unknown) {
    streamLogger.error("SSE setup error:", err);
    if (err instanceof AppError) {
      return new Response(
        JSON.stringify({ error: { message: err.message, code: err.statusCode } }),
        { status: err.statusCode, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: { message: "Failed to start SSE stream" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
