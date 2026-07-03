// /app/api/deep-research/[taskId]/stream/route.ts
// SSE endpoint that polls Gemini server-side and forwards events to the client.
// Replaces the client-side polling approach with a real-time stream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro: standard limit 800s. Deep Research can take 3–10 minutes,
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

/** Server-side poll interval — faster than client-side since there's no network overhead per poll */
const POLL_INTERVAL_PLANNING_MS = 2_000;
const POLL_INTERVAL_EXECUTING_MS = 5_000;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes max (internal safety net)

/**
 * GET /api/deep-research/[taskId]/stream
 *
 * Returns an SSE (Server-Sent Events) stream that forwards research progress
 * in real-time. The server polls Gemini every 2–5 seconds and pushes events
 * to the client, eliminating the need for client-side polling.
 *
 * Events:
 * - `task`: Updated task state (JSON)
 * - `complete`: Final task state (JSON), stream ends after
 * - `stream_error`: Error message (JSON) — named to avoid collision with EventSource connection errors
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

    // Shared flag — set to false by abort signal, cancel(), or internal exit conditions
    let running = true;

    const stream = new ReadableStream({
      async start(controller) {
        let lastStatus = "";
        let consecutiveErrors = 0;

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

              // Terminal state — send final event and close
              if (task.status === "completed" || task.status === "failed") {
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
        // Client disconnected — stop the poll loop
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
