// /app/api/novelcrafter/stream/route.ts
// POST SSE streaming endpoint for Novelcrafter Studio AI features

import { NextRequest, NextResponse } from "next/server";
import { assertModelAllowedForUser } from "@/lib/core/limits";
import { isStrataLocalModel } from "@/lib/core/modelRegistry";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { getStrataAdmission } from "@/lib/core/strataQueue";
import { auth } from "@/lib/features/auth/auth";
import { isValidGenerationModel } from "@/lib/features/novelcrafter/modelGuards.server";
import { runNovelcrafterStream } from "@/lib/features/novelcrafter/novelcrafterStreamRunner.server";
import { verifyNovelcrafterConversationOwnership } from "@/lib/features/novelcrafter/storyPersistence.server";
import { reserveNovelcrafterStreamQuota } from "@/lib/features/novelcrafter/streamQuotaGuard.server";
import { NovelcrafterStreamRequestSchema } from "@/lib/features/novelcrafter/types";
import {
  AppError,
  RateLimitError,
  sanitizeError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export const maxDuration = 300;

const routeLogger = logger.withContext("/api/novelcrafter/stream");

const MAX_STREAM_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MiB hard guard (P1)

function formatStreamRouteError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error instanceof RateLimitError && error.retryAfterSeconds) {
      headers["Retry-After"] = String(error.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: sanitizeError(error),
          code: error.code,
        },
      },
      { status: error.statusCode, headers }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: sanitizeError(error),
        code: "INTERNAL_ERROR",
      },
    },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.email?.toLowerCase()?.trim();
    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }

    const rl = await consumeRateLimit(`novelcrafter-stream:${userId}`);
    if (!rl.allowed) {
      throw new RateLimitError("Too many requests", rl.retryAfterSeconds);
    }

    const rawBody = await req.text();
    const byteLength = new TextEncoder().encode(rawBody).byteLength;
    if (byteLength > MAX_STREAM_PAYLOAD_BYTES) {
      throw new AppError("Stream request payload exceeds 2MB limit", 413, "PAYLOAD_TOO_LARGE");
    }

    let parsedJson: unknown;
    try {
      parsedJson = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const validated = NovelcrafterStreamRequestSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new ValidationError(
        validated.error.issues[0]?.message || "Invalid Novelcrafter stream request"
      );
    }

    const payload = validated.data;

    if (!isValidGenerationModel(payload.model)) {
      throw new ValidationError(`Invalid generation model: ${payload.model}`);
    }

    await assertModelAllowedForUser(userId, payload.model);
    await verifyNovelcrafterConversationOwnership(userId, payload.conversationId);

    if (isStrataLocalModel(payload.model)) {
      const admission = getStrataAdmission();
      if (!admission.ok) {
        throw new AppError(admission.message, admission.status, admission.code);
      }
    }

    const quotaReservation = await reserveNovelcrafterStreamQuota(userId);
    if (!quotaReservation.allowed) {
      throw new AppError(
        `Daily message limit reached (${quotaReservation.count}/${quotaReservation.limit})`,
        429,
        "DAILY_LIMIT_EXCEEDED"
      );
    }

    try {
      const stream = runNovelcrafterStream({
        userId,
        request: payload,
        signal: req.signal,
        onFirstModelOutput: quotaReservation.onFirstModelOutput,
        onStreamComplete: quotaReservation.releaseReservation,
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (streamInitErr: unknown) {
      await quotaReservation.releaseReservation();
      throw streamInitErr;
    }
  } catch (error: unknown) {
    routeLogger.error("POST /api/novelcrafter/stream failed:", error);
    return formatStreamRouteError(error);
  }
}
