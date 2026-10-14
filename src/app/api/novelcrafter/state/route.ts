// /app/api/novelcrafter/state/route.ts
// GET & PUT encrypted Novelcrafter Story State

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { assertModelAllowedForUser } from "@/lib/core/limits";
import { isSelectableModelId, normalizeModelForApi } from "@/lib/core/modelRegistry";
import { getStoryState, saveStoryState } from "@/lib/features/novelcrafter/storyPersistence.server";
import { NovelcrafterPutStateRequestSchema } from "@/lib/features/novelcrafter/types";
import { HTTP_STATUS, MODEL_IDS, UUID_REGEX } from "@/lib/utils/constants";
import { AppError } from "@/lib/utils/errors";
import { error, errorFromAppError, rateLimitError, success } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/novelcrafter/state");
const MAX_STATE_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB

function isValidGenerationModel(modelId: string): boolean {
  const trimmed = modelId.trim();
  if (!trimmed || trimmed === MODEL_IDS.NOVELCRAFTER || trimmed === MODEL_IDS.IMAGE_STUDIO) {
    return false;
  }
  const normalized = normalizeModelForApi(trimmed);
  if (normalized === MODEL_IDS.NOVELCRAFTER || normalized === MODEL_IDS.IMAGE_STUDIO) {
    return false;
  }
  return isSelectableModelId(trimmed) || isSelectableModelId(normalized);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      return error("Unauthorized", HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED");
    }

    const rl = await consumeRateLimit(`novelcrafter-state:${email}`);
    if (!rl.allowed) {
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim() || "";
    if (!UUID_REGEX.test(conversationId)) {
      return error("Invalid conversationId", HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    const state = await getStoryState(email, conversationId);
    return success({ conversationId, state });
  } catch (err: unknown) {
    routeLogger.error("GET /api/novelcrafter/state error:", err);
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    return error(err, HTTP_STATUS.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }
}

export async function PUT(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_STATE_PAYLOAD_BYTES) {
    return error("Payload too large", HTTP_STATUS.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE");
  }

  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      return error("Unauthorized", HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED");
    }

    const rl = await consumeRateLimit(`novelcrafter-state:${email}`);
    if (!rl.allowed) {
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return error("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    const parsed = NovelcrafterPutStateRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid story state payload";
      return error(firstIssue, HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    const { conversationId, state } = parsed.data;

    if (!isValidGenerationModel(state.selectedModel)) {
      return error(
        "Invalid selectedModel for story generation",
        HTTP_STATUS.BAD_REQUEST,
        "VALIDATION_ERROR"
      );
    }

    await assertModelAllowedForUser(email, state.selectedModel);

    const savedState = await saveStoryState(email, conversationId, state);
    return success({ conversationId, state: savedState });
  } catch (err: unknown) {
    routeLogger.error("PUT /api/novelcrafter/state error:", err);
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    return error(err, HTTP_STATUS.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }
}
