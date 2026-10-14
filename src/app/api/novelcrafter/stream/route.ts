// /app/api/novelcrafter/stream/route.ts
// POST SSE streaming endpoint for the 5 Sudowrite AI features in Novelcrafter Studio

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import {
  assertModelAllowedForUser,
  checkDailyMessageLimit,
  incrementDailyMessageCount,
} from "@/lib/core/limits";
import { isSelectableModelId, normalizeModelForApi } from "@/lib/core/modelRegistry";
import { verifyNovelcrafterConversationOwnership } from "@/lib/features/novelcrafter/storyPersistence.server";
import { runNovelcrafterStream } from "@/lib/features/novelcrafter/novelcrafterStreamRunner.server";
import { NovelcrafterStreamRequestSchema } from "@/lib/features/novelcrafter/types";
import { HTTP_STATUS, MODEL_IDS } from "@/lib/utils/constants";
import { AppError } from "@/lib/utils/errors";
import { error, errorFromAppError, rateLimitError } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("POST /api/novelcrafter/stream");
const MAX_STREAM_PAYLOAD_BYTES = 1024 * 1024; // 1MB

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

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_STREAM_PAYLOAD_BYTES) {
    return error("Payload too large", HTTP_STATUS.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE");
  }

  try {
    const session = await auth();
    const userId = session?.user?.email?.toLowerCase();
    if (!userId) {
      return error("Unauthorized", HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED");
    }

    const messageLimit = await checkDailyMessageLimit(userId);
    if (messageLimit.rank === "not_whitelisted") {
      return error("Access Pending Approval", HTTP_STATUS.FORBIDDEN, "ACCESS_PENDING", {
        message: "Your account is pending admin approval.",
        rank: "not_whitelisted",
      });
    }

    if (!messageLimit.canSend) {
      return error(
        "Daily message limit exceeded",
        HTTP_STATUS.RATE_LIMIT_EXCEEDED,
        "DAILY_LIMIT_EXCEEDED",
        {
          count: messageLimit.count,
          limit: messageLimit.limit,
        }
      );
    }

    const rl = await consumeRateLimit(`novelcrafter-stream:${userId}`);
    if (!rl.allowed) {
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return error("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    const parsed = NovelcrafterStreamRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid stream request";
      return error(firstIssue, HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    const requestData = parsed.data;

    if (!isValidGenerationModel(requestData.model)) {
      return error("Invalid generation model", HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR");
    }

    await assertModelAllowedForUser(userId, requestData.model);
    await verifyNovelcrafterConversationOwnership(userId, requestData.conversationId);

    const stream = runNovelcrafterStream({
      userId,
      request: requestData,
      signal: req.signal,
    });

    try {
      await incrementDailyMessageCount(userId);
    } catch (incErr: unknown) {
      routeLogger.warn("Failed to increment daily message count:", incErr);
    }

    return new Response(stream, {
      status: HTTP_STATUS.OK,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    routeLogger.error("POST /api/novelcrafter/stream error:", err);
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    return error(err, HTTP_STATUS.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
  }
}
