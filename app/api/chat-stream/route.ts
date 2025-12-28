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

import { handleChatStreamCore } from "@/app/api/chat-stream/chatStreamCore";
import { createPerformanceMonitor } from "@/lib/utils/performance";

const routeLogger = logger.withContext("POST /api/chat-stream");

export async function POST(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/chat-stream", "POST");
  
  try {
    const session = await auth();
    if (!session?.user?.email) {
      routeLogger.warn("Unauthorized request - no session");
      perfMonitor.end(HTTP_STATUS.UNAUTHORIZED);
      return new Response("Unauthorized", { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const userId = session.user.email.toLowerCase();
    routeLogger.debug("Processing request for user:", userId);
    perfMonitor.userId = userId;

    const rl = await consumeRateLimit(`chat-stream:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for user: ${userId}`);
      perfMonitor.end(429, { rateLimited: true });
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    const response = await handleChatStreamCore({ req, userId });
    perfMonitor.end(200, { streaming: true });
    return response;
  } catch (e) {
    routeLogger.error("Route error:", e);
    
    const statusCode = e instanceof AppError ? e.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    perfMonitor.end(statusCode, { error: true });
    
    if (e instanceof AppError) {
      return errorFromAppError(e);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

