// /app/api/deep-research/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { createResearchTask } from "@/lib/features/research/researchService.server";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, UnauthorizedError, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import type { CreateResearchRequest, ResearchAgent } from "@/lib/features/research/types";

const routeLogger = logger.withContext("/api/deep-research");

const VALID_AGENTS: ResearchAgent[] = [
  "deep-research-preview-04-2026",
  "deep-research-max-preview-04-2026",
];

function isValidAgent(agent: unknown): agent is ResearchAgent {
  return typeof agent === "string" && VALID_AGENTS.includes(agent as ResearchAgent);
}

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

    // Validate optional agent model
    if (body.agentModel !== undefined && !isValidAgent(body.agentModel)) {
      throw new ValidationError("Invalid agent model");
    }

    // Validate optional UUIDs
    if (body.conversationId !== undefined && typeof body.conversationId !== "string") {
      throw new ValidationError("conversationId must be a string");
    }
    if (body.projectId !== undefined && typeof body.projectId !== "string") {
      throw new ValidationError("projectId must be a string");
    }
    if (body.gemId !== undefined && typeof body.gemId !== "string") {
      throw new ValidationError("gemId must be a string");
    }

    const request: CreateResearchRequest = {
      query: body.query,
      agentModel: body.agentModel as ResearchAgent | undefined,
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
