// /app/api/deep-research/[taskId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/lib/features/auth/auth";
import { checkResearchStatus } from "@/lib/features/research/researchService.server";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { UUID_REGEX } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/deep-research/[taskId]");

/**
 * GET /api/deep-research/[taskId]
 * Checks the status of a research task, polling Gemini if still in progress.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const { taskId } = await params;

    if (!taskId || !UUID_REGEX.test(taskId)) {
      throw new ValidationError("Invalid task ID");
    }

    const task = await checkResearchStatus(userId, taskId);

    // Build progress info based on status
    let progress: { phase: string; detail?: string } | undefined;
    switch (task.status) {
      case "planning":
        progress = { phase: "planning", detail: "Generating research plan..." };
        break;
      case "ready_to_execute":
        progress = { phase: "plan_ready", detail: "Plan ready for review" };
        break;
      case "executing":
        progress = { phase: "executing", detail: "Researching and writing report..." };
        break;
      case "completed":
        progress = { phase: "completed", detail: "Research complete" };
        break;
      case "failed":
        progress = { phase: "failed", detail: task.errorMessage || "Research failed" };
        break;
    }

    return success({ task, progress });
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to check research status", 500);
  }
}
