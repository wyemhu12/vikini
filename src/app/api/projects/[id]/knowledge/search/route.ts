/**
 * Knowledge Search API
 * POST: Semantic search across project knowledge base
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApprovedUser } from "@/lib/features/auth/requireApprovedUser";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { searchKnowledge } from "@/lib/features/projects/knowledge.server";
import { getProject } from "@/lib/features/projects/projects.server";
import { ValidationError, NotFoundError, AppError, RateLimitError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("api/projects/[id]/knowledge/search");

interface RouteParams {
  params: Promise<{ id: string }>;
}

const searchSchema = z.object({
  query: z.string().min(1, "Query is required").max(1000, "Query too long"),
  threshold: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

/**
 * POST /api/projects/[id]/knowledge/search - Semantic search
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await requireApprovedUser();
    const rl = await consumeRateLimit(`knowledge-search:${userId}`);
    if (!rl.allowed) {
      throw new RateLimitError("Too many requests. Please wait.", rl.retryAfterSeconds);
    }
    const { id: projectId } = await params;

    // Verify project exists and user owns it
    const project = await getProject(projectId, userId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    const body = await req.json();
    let parsed;
    try {
      parsed = searchSchema.parse(body);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        throw new ValidationError(`Invalid request: ${e.issues[0].message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const results = await searchKnowledge(projectId, userId, parsed.query, {
      threshold: parsed.threshold,
      limit: parsed.limit,
    });

    routeLogger.info(
      `Search in project ${projectId}: "${parsed.query.slice(0, 50)}..." → ${results.length} results`
    );

    return success({
      results,
      query: parsed.query,
      project_id: projectId,
    });
  } catch (err: unknown) {
    routeLogger.error("Search failed", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Search failed", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
