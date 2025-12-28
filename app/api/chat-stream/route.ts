// /app/api/chat-stream/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { logger } from "@/lib/utils/logger";
import { AppError } from "@/lib/utils/errors";
import { errorFromAppError, rateLimitError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";

import { handleChatStreamCore } from "./chatStreamCore.ts";

const routeLogger = logger.withContext("POST /api/chat-stream");

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      routeLogger.warn("Unauthorized request - no session");
      return new Response("Unauthorized", { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const userId = session.user.email.toLowerCase();
    routeLogger.debug("Processing request for user:", userId);

    const rl = await consumeRateLimit(`chat-stream:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for user: ${userId}`);
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    return await handleChatStreamCore({ req, userId });
  } catch (e) {
    routeLogger.error("Route error:", e);
    
    if (e instanceof AppError) {
      return errorFromAppError(e);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

