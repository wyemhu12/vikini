// lib/features/research/researchService.server.ts
// Server-only service for Deep Research operations

import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { createResearchInteraction, getResearchInteraction } from "@/lib/core/genaiClient";
import { canDoResearch, incrementResearchCount } from "@/lib/core/limits";
import { encryptText } from "@/lib/core/encryption";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  ExternalServiceError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import type { ResearchTask, CreateResearchRequest, ResearchAgent, ResearchStatus } from "./types";

const researchLogger = logger.withContext("research");

// Default agent model
const DEFAULT_AGENT: ResearchAgent = "deep-research-preview-04-2026";

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
  // Check permissions
  const allowed = await canDoResearch(userId);
  if (!allowed) {
    throw new ForbiddenError("Deep Research not available or daily limit reached");
  }

  // Validate query
  if (!request.query || request.query.trim().length === 0) {
    throw new ValidationError("Query is required");
  }
  if (request.query.length > 2000) {
    throw new ValidationError("Query must be 2000 characters or fewer");
  }

  const supabase = getSupabaseAdmin();
  const agentModel = request.agentModel || DEFAULT_AGENT;

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

  // Increment daily count
  await incrementResearchCount(userId);

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

  if (task.status !== "ready_to_execute" && task.status !== "planning") {
    throw new ValidationError(`Cannot approve task in '${task.status}' status`);
  }

  // Create execution interaction, referencing the plan interaction
  try {
    const input = feedback
      ? `Proceed with the research plan. User feedback: ${feedback}`
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
        // Research report is ready - finalize
        const { data: updatedRow } = await supabase
          .from("research_tasks")
          .update({
            status: "completed",
            report_text: result.outputText,
          })
          .eq("id", taskId)
          .select("*")
          .single();

        const finalTask = mapTaskRow((updatedRow || taskRow) as ResearchTaskRow);

        // Save results to conversation (fire-and-forget)
        finalizeResearch(finalTask, result.outputText).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          researchLogger.error("Failed to finalize research:", msg);
        });

        return finalTask;
      }
    } else if (result.status === "failed" || result.error) {
      const errorMsg = result.error || "Research failed";
      await supabase
        .from("research_tasks")
        .update({ status: "failed", error_message: errorMsg })
        .eq("id", taskId);

      return {
        ...task,
        status: "failed",
        errorMessage: errorMsg,
      };
    }

    // Still in progress
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
    const title = task.query.length > 60 ? `${task.query.substring(0, 57)}...` : task.query;

    const now = new Date().toISOString();
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: task.userId,
        title: `🔬 ${title}`,
        model: "deep-research",
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
  } catch {
    // Encryption failure is non-fatal
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
  } catch {
    // Encryption failure is non-fatal
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

  // Update conversation preview
  const preview = report.length > 100 ? `${report.substring(0, 97)}...` : report;

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

  const title = `Deep Research: ${query.substring(0, 100)}`;

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
    .limit(50);

  if (error) {
    throw new DatabaseError(`Failed to fetch research tasks: ${error.message}`);
  }

  return (data || []).map((row) => mapTaskRow(row as ResearchTaskRow));
}
