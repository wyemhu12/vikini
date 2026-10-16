// /app/api/novelcrafter/state/route.ts
// GET and PUT endpoints for Novelcrafter Story State (Story Bible, Chapters, History Cards, Routing)

import { NextRequest, NextResponse } from "next/server";
import { assertModelAllowedForUser } from "@/lib/core/limits";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { auth } from "@/lib/features/auth/auth";
import { isValidGenerationModel } from "@/lib/features/novelcrafter/modelGuards.server";
import { getStoryState, saveStoryState } from "@/lib/features/novelcrafter/storyPersistence.server";
import { NovelcrafterPutStateRequestSchema } from "@/lib/features/novelcrafter/types";
import { UUID_REGEX } from "@/lib/utils/constants";
import {
  AppError,
  RateLimitError,
  sanitizeError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/novelcrafter/state");

const MAX_STATE_BODY_BYTES = 2 * 1024 * 1024; // 2 MiB hard guard (P1)

async function requireAuthenticatedEmail(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.email?.toLowerCase()?.trim();
  if (!userId) {
    throw new UnauthorizedError("Authentication required");
  }
  return userId;
}

function formatErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    if (error.code === "DESTRUCTIVE_SAVE_REJECTED") {
      const extra = error as AppError & { previousChars?: number; nextChars?: number };
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
          code: error.code,
          previousChars: extra.previousChars ?? 0,
          nextChars: extra.nextChars ?? 0,
        },
        { status: 409 }
      );
    }

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

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuthenticatedEmail();

    const rl = await consumeRateLimit(`novelcrafter-state-get:${userId}`);
    if (!rl.allowed) {
      throw new RateLimitError("Too many requests", rl.retryAfterSeconds);
    }

    const { searchParams } = new URL(req.url);
    const conversationId = (searchParams.get("conversationId") || "").trim();

    if (!conversationId || !UUID_REGEX.test(conversationId)) {
      throw new ValidationError("Valid conversationId query parameter is required");
    }

    const state = await getStoryState(userId, conversationId);

    return NextResponse.json({
      success: true,
      data: { state },
    });
  } catch (error: unknown) {
    routeLogger.error("GET /api/novelcrafter/state failed:", error);
    return formatErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await requireAuthenticatedEmail();

    const rl = await consumeRateLimit(`novelcrafter-state-put:${userId}`);
    if (!rl.allowed) {
      throw new RateLimitError("Too many requests", rl.retryAfterSeconds);
    }

    const rawBody = await req.text();
    const byteLength = new TextEncoder().encode(rawBody).byteLength;
    if (byteLength > MAX_STATE_BODY_BYTES) {
      throw new AppError("Story state payload exceeds 2MB limit", 413, "PAYLOAD_TOO_LARGE");
    }

    let parsedJson: unknown;
    try {
      parsedJson = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const validated = NovelcrafterPutStateRequestSchema.safeParse(parsedJson);
    if (!validated.success) {
      throw new ValidationError(
        validated.error.issues[0]?.message || "Invalid story state payload"
      );
    }

    const { conversationId, state, allowDestructive } = validated.data;

    if (!isValidGenerationModel(state.selectedModel)) {
      throw new ValidationError(`Invalid generation model: ${state.selectedModel}`);
    }

    await assertModelAllowedForUser(userId, state.selectedModel);

    const savedState = await saveStoryState(userId, conversationId, state, {
      allowDestructive,
    });

    return NextResponse.json({
      success: true,
      data: { state: savedState },
    });
  } catch (error: unknown) {
    routeLogger.error("PUT /api/novelcrafter/state failed:", error);
    return formatErrorResponse(error);
  }
}
