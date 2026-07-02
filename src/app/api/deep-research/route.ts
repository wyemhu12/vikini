// /app/api/deep-research/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { createResearchTask } from "@/lib/features/research/researchService.server";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { UUID_REGEX } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";
import { isValidAgent, type CreateResearchRequest } from "@/lib/features/research/types";

const routeLogger = logger.withContext("/api/deep-research");

/**
 * POST /api/deep-research
 * Creates a new Deep Research task with collaborative planning.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rawBody: unknown = await req.json().catch(() => ({}));

    if (typeof rawBody !== "object" || rawBody === null) {
      throw new ValidationError("Invalid request body");
    }

    const body = rawBody as Record<string, unknown>;

    // Validate query
    if (typeof body.query !== "string" || body.query.trim().length === 0) {
      throw new ValidationError("Query is required");
    }
    if (body.query.length > 2000) {
      throw new ValidationError("Query must be 2000 characters or fewer");
    }

    // Validate optional agent model (use shared isValidAgent from types — BUG-08)
    if (body.agentModel !== undefined && !isValidAgent(body.agentModel)) {
      throw new ValidationError("Invalid agent model");
    }

    // Validate optional UUID fields — must be valid UUIDs, not arbitrary strings (BUG-11)
    if (body.conversationId !== undefined) {
      if (typeof body.conversationId !== "string" || !UUID_REGEX.test(body.conversationId)) {
        throw new ValidationError("conversationId must be a valid UUID");
      }
    }
    if (body.projectId !== undefined) {
      if (typeof body.projectId !== "string" || !UUID_REGEX.test(body.projectId)) {
        throw new ValidationError("projectId must be a valid UUID");
      }
    }
    if (body.gemId !== undefined) {
      if (typeof body.gemId !== "string" || !UUID_REGEX.test(body.gemId)) {
        throw new ValidationError("gemId must be a valid UUID");
      }
    }

    const request: CreateResearchRequest = {
      query: body.query,
      agentModel: isValidAgent(body.agentModel) ? body.agentModel : undefined,
      conversationId: body.conversationId as string | undefined,
      projectId: body.projectId as string | undefined,
      gemId: body.gemId as string | undefined,
    };

    const task = await createResearchTask(userId, request);
    return success({ task });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to create research task", 500);
  }
}
