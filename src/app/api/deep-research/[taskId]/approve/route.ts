// /app/api/deep-research/[taskId]/approve/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { approveResearchPlan } from "@/lib/features/research/researchService.server";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/deep-research/[taskId]/approve");

// UUID v4 pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/deep-research/[taskId]/approve
 * Approves a research plan and triggers full execution.
 * Optionally accepts user feedback to refine the plan.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const { taskId } = await params;

    if (!taskId || !UUID_REGEX.test(taskId)) {
      throw new ValidationError("Invalid task ID");
    }

    const rawBody: unknown = await req.json().catch(() => ({}));
    let feedback: string | undefined;

    if (typeof rawBody === "object" && rawBody !== null) {
      const body = rawBody as Record<string, unknown>;
      if (body.feedback !== undefined) {
        if (typeof body.feedback !== "string") {
          throw new ValidationError("Feedback must be a string");
        }
        if (body.feedback.length > 2000) {
          throw new ValidationError("Feedback must be 2000 characters or fewer");
        }
        feedback = body.feedback;
      }
    }

    const task = await approveResearchPlan(userId, taskId, feedback);
    return success({ task });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to approve research plan", 500);
  }
}
