// lib/features/research/researchService.server.ts
// Server-only service for Deep Research operations

import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { createResearchInteraction, getResearchInteraction } from "@/lib/core/genaiClient";
import { tryClaimResearchSlot } from "@/lib/core/limits";
import { encryptText } from "@/lib/core/encryption";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ExternalServiceError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import {
  VALID_AGENTS,
  type ResearchTask,
  type CreateResearchRequest,
  type ResearchAgent,
  type ResearchStatus,
  type ResearchSource,
} from "./types";

const researchLogger = logger.withContext("research");

// Default agent model
const DEFAULT_AGENT: ResearchAgent = "deep-research-preview-04-2026";

// Magic number constants
const MAX_QUERY_LENGTH = 2000;
const TITLE_MAX_LENGTH = 60;
const TITLE_TRUNCATE_LENGTH = 57;
const PREVIEW_MAX_LENGTH = 100;
const PREVIEW_TRUNCATE_LENGTH = 97;
const LIST_DEFAULT_LIMIT = 50;
const DEFAULT_CONVERSATION_MODEL = "deep-research";

// =====================================================================================
// Row Mapper
// =====================================================================================

interface ResearchTaskRow {
  id: string;
  user_id: string;
  query: string;
  agent_model: string;
  plan_text: string | null;
  report_text: string | null;
  status: string;
  plan_interaction_id: string | null;
  exec_interaction_id: string | null;
  conversation_id: string | null;
  project_id: string | null;
  gem_id: string | null;
  error_message: string | null;
  sources: unknown;
  created_at: string;
  updated_at: string;
}

function mapTaskRow(row: ResearchTaskRow): ResearchTask {
  return {
    id: row.id,
    userId: row.user_id,
    query: row.query,
    agentModel: row.agent_model as ResearchAgent,
    planText: row.plan_text,
    reportText: row.report_text,
    status: row.status as ResearchStatus,
    planInteractionId: row.plan_interaction_id,
    execInteractionId: row.exec_interaction_id,
    conversationId: row.conversation_id,
    projectId: row.project_id,
    gemId: row.gem_id,
    errorMessage: row.error_message,
    // Validate each element's shape instead of blindly casting the array (BUG-04)
    sources: Array.isArray(row.sources)
      ? (row.sources as unknown[]).filter(
          (s): s is ResearchSource =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as ResearchSource).url === "string" &&
            typeof (s as ResearchSource).title === "string"
        )
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =====================================================================================
// Create Research Task
// =====================================================================================

/**
 * Creates a new Deep Research task.
 * 1. Checks user permissions and daily limits
 * 2. Creates DB row
 * 3. Calls Gemini Interactions API for planning phase
 * 4. Updates DB with interaction ID
 */
export async function createResearchTask(
  userId: string,
  request: CreateResearchRequest
): Promise<ResearchTask> {
  // Validate query first (before claiming the slot, so bad requests don't consume quota)
  if (!request.query || request.query.trim().length === 0) {
    throw new ValidationError("Query is required");
  }
  if (request.query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`Query must be ${MAX_QUERY_LENGTH} characters or fewer`);
  }

  // Atomically claim one research slot — checks feature flag, increments, and verifies
  // the new count is within the limit. Eliminates the TOCTOU race of the old
  // canDoResearch() → incrementResearchCount() two-step pattern (BUG-02).
  const claimed = await tryClaimResearchSlot(userId);
  if (!claimed) {
    throw new ForbiddenError("Deep Research not available or daily limit reached");
  }

  const supabase = getSupabaseAdmin();
  // Validate agentModel against canonical list (BUG-08 — single source of truth)
  const agentModel: ResearchAgent =
    request.agentModel && (VALID_AGENTS as readonly string[]).includes(request.agentModel)
      ? request.agentModel
      : DEFAULT_AGENT;

  // Create task in DB
  const { data: taskRow, error: insertError } = await supabase
    .from("research_tasks")
    .insert({
      user_id: userId,
      query: request.query.trim(),
      agent_model: agentModel,
      status: "planning" as const,
      conversation_id: request.conversationId || null,
      project_id: request.projectId || null,
      gem_id: request.gemId || null,
    })
    .select("*")
    .single();

  if (insertError || !taskRow) {
    throw new DatabaseError(`Failed to create research task: ${insertError?.message}`);
  }

  // Call Gemini Interactions API for collaborative planning
  try {
    const interaction = await createResearchInteraction({
      input: request.query.trim(),
      agent: agentModel,
      collaborativePlanning: true,
    });

    // Update task with interaction ID
    const { error: updateError } = await supabase
      .from("research_tasks")
      .update({
        plan_interaction_id: interaction.id,
        // If the interaction already returned output (fast response), save it
        ...(interaction.outputText
          ? { plan_text: interaction.outputText, status: "ready_to_execute" }
          : {}),
      })
      .eq("id", taskRow.id);

    if (updateError) {
      researchLogger.warn("Failed to update task with interaction ID:", updateError);
    }

    // NOTE: Daily count was already atomically claimed via tryClaimResearchSlot() above.
    // Do NOT call incrementResearchCount() here — that would double-count.

    // Refetch the updated task
    const { data: updatedRow } = await supabase
      .from("research_tasks")
      .select("*")
      .eq("id", taskRow.id)
      .single();

    return mapTaskRow((updatedRow || taskRow) as ResearchTaskRow);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    researchLogger.error("Gemini interaction creation failed:", message);

    // Mark task as failed
    await supabase
      .from("research_tasks")
      .update({ status: "failed", error_message: message })
      .eq("id", taskRow.id);

    throw new ExternalServiceError("Gemini", `Failed to start research: ${message}`);
  }
}

// =====================================================================================
// Approve Research Plan
// =====================================================================================

/**
 * Approves a research plan and triggers execution.
 * Optionally includes user feedback to refine the plan.
 */
export async function approveResearchPlan(
  userId: string,
  taskId: string,
  feedback?: string
): Promise<ResearchTask> {
  const supabase = getSupabaseAdmin();

  // Fetch task and verify ownership
  const { data: taskRow, error: fetchError } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !taskRow) {
    throw new NotFoundError("Research task");
  }

  const task = mapTaskRow(taskRow as ResearchTaskRow);

  if (task.userId !== userId) {
    throw new ForbiddenError("Not authorized to access this research task");
  }

  if (task.status !== "ready_to_execute") {
    throw new ValidationError(`Cannot approve task in '${task.status}' status`);
  }

  // Create execution interaction, referencing the plan interaction
  try {
    // Wrap user feedback in delimiters to prevent prompt injection (BUG-05)
    const input = feedback
      ? `Proceed with the research plan.\n\n<user_feedback>\n${feedback}\n</user_feedback>`
      : "Proceed with the research plan.";

    const interaction = await createResearchInteraction({
      input,
      agent: task.agentModel,
      collaborativePlanning: false,
      previousInteractionId: task.planInteractionId || undefined,
    });

    // Update task status to executing
    const { data: updatedRow, error: updateError } = await supabase
      .from("research_tasks")
      .update({
        status: "executing",
        exec_interaction_id: interaction.id,
      })
      .eq("id", taskId)
      .select("*")
      .single();

    if (updateError) {
      throw new DatabaseError(`Failed to update task: ${updateError.message}`);
    }

    return mapTaskRow(updatedRow as ResearchTaskRow);
  } catch (err: unknown) {
    if (
      err instanceof ForbiddenError ||
      err instanceof ValidationError ||
      err instanceof NotFoundError ||
      err instanceof DatabaseError
    ) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    researchLogger.error("Failed to start research execution:", message);

    await supabase
      .from("research_tasks")
      .update({ status: "failed", error_message: message })
      .eq("id", taskId);

    throw new ExternalServiceError("Gemini", `Failed to execute research: ${message}`);
  }
}

// =====================================================================================
// Check Research Status
// =====================================================================================

/**
 * Polls the Gemini interaction status and updates the DB.
 * Returns current task state with progress information.
 */
export async function checkResearchStatus(userId: string, taskId: string): Promise<ResearchTask> {
  const supabase = getSupabaseAdmin();

  // Fetch task and verify ownership
  const { data: taskRow, error: fetchError } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !taskRow) {
    throw new NotFoundError("Research task");
  }

  const task = mapTaskRow(taskRow as ResearchTaskRow);

  if (task.userId !== userId) {
    throw new ForbiddenError("Not authorized to access this research task");
  }

  // If already completed or failed, just return current state
  if (task.status === "completed" || task.status === "failed") {
    return task;
  }

  // Determine which interaction to poll
  const interactionId = task.execInteractionId || task.planInteractionId;
  if (!interactionId) {
    return task;
  }

  // Poll Gemini for status
  try {
    const result = await getResearchInteraction(interactionId);

    if (result.status === "completed" && result.outputText) {
      if (task.status === "planning") {
        // Plan is ready
        const { data: updatedRow } = await supabase
          .from("research_tasks")
          .update({
            status: "ready_to_execute",
            plan_text: result.outputText,
          })
          .eq("id", taskId)
          .select("*")
          .single();

        return mapTaskRow((updatedRow || taskRow) as ResearchTaskRow);
      } else if (task.status === "executing") {
        // Research report is ready - finalize.
        // Store the raw AI output WITHOUT appending a hardcoded Vietnamese header (BUG-06).
        // Sources are stored separately in the `sources` column; the UI renders them with i18n.
        const finalOutput = result.outputText || "";

        const { data: updatedRow } = await supabase
          .from("research_tasks")
          .update({
            status: "completed",
            report_text: finalOutput,
            sources:
              result.reportSources && result.reportSources.length > 0 ? result.reportSources : null,
          })
          .eq("id", taskId)
          .select("*")
          .single();

        const finalTask = mapTaskRow((updatedRow || taskRow) as ResearchTaskRow);

        // Save results to conversation
        try {
          await finalizeResearch(finalTask, finalOutput);
        } catch (finalizeErr: unknown) {
          const errMsg =
            finalizeErr instanceof Error ? finalizeErr.message : "Unknown finalize error";
          researchLogger.error(
            "Failed to finalize research (report saved but conversation not created):",
            errMsg
          );
          // Report is saved in the task, so don't change status — user can still view it
        }

        return finalTask;
      }
    } else if (result.status === "failed" || result.error) {
      const errorMsg = result.error || "Research failed";
      await supabase
        .from("research_tasks")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", taskId);
      // Return immutable copy instead of mutating the fetched object (BUG-03)
      return { ...task, status: "failed" as ResearchStatus, errorMessage: errorMsg };
    }

    // Attach transient data if we are still polling
    task.thinkingText = result.thinkingText;
    task.searchedSources = result.searchedSources;
    task.currentStep = result.currentStep;

    return task;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    researchLogger.warn("Error polling research status:", message);
    // Don't fail the task on polling errors, just return current state
    return task;
  }
}

// =====================================================================================
// Finalize Research
// =====================================================================================

/**
 * Saves research results to a conversation.
 * If conversationId exists, adds messages there.
 * Otherwise, creates a new conversation.
 */
export async function finalizeResearch(task: ResearchTask, report: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  let conversationId = task.conversationId;

  // Create a new conversation if needed
  if (!conversationId) {
    const title =
      task.query.length > TITLE_MAX_LENGTH
        ? `${task.query.substring(0, TITLE_TRUNCATE_LENGTH)}...`
        : task.query;

    const now = new Date().toISOString();
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: task.userId,
        title: `🔬 ${title}`,
        model: DEFAULT_CONVERSATION_MODEL,
        created_at: now,
        updated_at: now,
        project_id: task.projectId || null,
        gem_id: task.gemId || null,
      })
      .select("id")
      .single();

    if (convError || !conv) {
      researchLogger.error("Failed to create conversation for research:", convError);
      return;
    }

    conversationId = conv.id;

    // Update task with conversation ID
    await supabase
      .from("research_tasks")
      .update({ conversation_id: conversationId })
      .eq("id", task.id);
  }

  // Save user message (the query)
  let encryptedQuery = task.query;
  try {
    const encrypted = encryptText(task.query);
    if (encrypted) encryptedQuery = encrypted;
  } catch (encErr: unknown) {
    // Encryption failure is non-fatal
    researchLogger.warn(
      "Query encryption failed:",
      encErr instanceof Error ? encErr.message : "Unknown error"
    );
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: encryptedQuery,
    meta: { type: "text" },
  });

  // Save assistant message (the report)
  let encryptedReport = report;
  try {
    const encrypted = encryptText(report);
    if (encrypted) encryptedReport = encrypted;
  } catch (encErr: unknown) {
    // Encryption failure is non-fatal
    researchLogger.warn(
      "Report encryption failed:",
      encErr instanceof Error ? encErr.message : "Unknown error"
    );
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: encryptedReport,
    meta: {
      type: "text",
      researchTaskId: task.id,
      agentModel: task.agentModel,
    },
  });

  // Update conversation preview — strip leading markdown so the sidebar shows readable text (BUG-07)
  const cleanReport = report
    .replace(/^#{1,6}\s+.*/gm, "") // remove header lines
    .replace(/\*\*(.+?)\*\*/g, "$1") // unwrap bold
    .replace(/\*(.+?)\*/g, "$1") // unwrap italic
    .trim();
  const previewSource = cleanReport || report;
  const preview =
    previewSource.length > PREVIEW_MAX_LENGTH
      ? `${previewSource.substring(0, PREVIEW_TRUNCATE_LENGTH)}...`
      : previewSource;

  await supabase
    .from("conversations")
    .update({
      last_message_preview: preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  // If project linked, add report to knowledge base (best-effort)
  if (task.projectId) {
    try {
      await addResearchToProjectKB(task.projectId, task.userId, task.query, report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      researchLogger.warn("Failed to add research to project KB:", msg);
    }
  }
}

// =====================================================================================
// Project Knowledge Base Integration
// =====================================================================================

/**
 * Adds the research report as a document in the project's knowledge base.
 */
async function addResearchToProjectKB(
  projectId: string,
  userId: string,
  query: string,
  report: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const title = `Deep Research: ${query.substring(0, PREVIEW_MAX_LENGTH)}`;

  await supabase.from("knowledge_documents").insert({
    project_id: projectId,
    user_id: userId,
    title,
    content: report,
    file_type: "text/markdown",
    file_size: Buffer.byteLength(report, "utf-8"),
    status: "processed",
  });
}

// =====================================================================================
// List Research Tasks
// =====================================================================================

/**
 * Lists all research tasks for a user, ordered by most recent first.
 */
export async function getResearchTasks(userId: string): Promise<ResearchTask[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_DEFAULT_LIMIT);

  if (error) {
    throw new DatabaseError(`Failed to fetch research tasks: ${error.message}`);
  }

  return (data || []).map((row) => mapTaskRow(row as ResearchTaskRow));
}

// =====================================================================================
// Cancel Research Task
// =====================================================================================

/**
 * Cancels an in-progress research task.
 * Marks the DB row as failed with "Cancelled by user" so the client stops polling.
 * NOTE: The Gemini Interactions API does not yet support server-side cancellation,
 * so the underlying agent may continue running briefly, but no further DB writes
 * will occur after this call because checkResearchStatus exits early on terminal states.
 */
export async function cancelResearchTask(userId: string, taskId: string): Promise<ResearchTask> {
  const supabase = getSupabaseAdmin();

  const { data: taskRow, error: fetchError } = await supabase
    .from("research_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !taskRow) {
    throw new NotFoundError("Research task");
  }

  const task = mapTaskRow(taskRow as ResearchTaskRow);

  if (task.userId !== userId) {
    throw new ForbiddenError("Not authorized to access this research task");
  }

  // Already in a terminal state — nothing to cancel
  if (task.status === "completed" || task.status === "failed") {
    return task;
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("research_tasks")
    .update({ status: "failed", error_message: "Cancelled by user" })
    .eq("id", taskId)
    .select("*")
    .single();

  if (updateError) {
    throw new DatabaseError(`Failed to cancel research task: ${updateError.message}`);
  }

  return mapTaskRow((updatedRow || taskRow) as ResearchTaskRow);
}
