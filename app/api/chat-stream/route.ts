// /app/api/chat-stream/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import { logger } from "@/lib/utils/logger";
import { AppError } from "@/lib/utils/errors";
import { errorFromAppError, rateLimitError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";

import { handleChatStreamCore } from "@/app/api/chat-stream/chatStreamCore";
import { createPerformanceMonitor } from "@/lib/utils/performance";

const routeLogger = logger.withContext("POST /api/chat-stream");

export async function POST(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/chat-stream", "POST");

  // SECURITY: Check content length to prevent large payload attacks
  const contentLength = Number(req.headers.get("content-length") || 0);
  const MAX_PAYLOAD_SIZE = 1 * 1024 * 1024; // 1MB
  if (contentLength > MAX_PAYLOAD_SIZE) {
    routeLogger.warn(`Payload too large: ${contentLength} bytes`);
    perfMonitor.end(HTTP_STATUS.BAD_REQUEST);
    return new Response("Payload too large", { status: HTTP_STATUS.BAD_REQUEST });
  }

  try {
    const session = await auth();
    if (!session?.user?.email) {
      routeLogger.warn("Unauthorized request - no session");
      perfMonitor.end(HTTP_STATUS.UNAUTHORIZED);
      return new Response("Unauthorized", { status: HTTP_STATUS.UNAUTHORIZED });
    }

    // Use email as userId for consistency with conversations table
    const userId = session.user.email?.toLowerCase() || session.user.id || "";
    if (!userId) {
      routeLogger.warn("No user ID available");
      perfMonitor.end(HTTP_STATUS.UNAUTHORIZED);
      return new Response("Unauthorized", { status: HTTP_STATUS.UNAUTHORIZED });
    }

    routeLogger.debug("Processing request for user:", userId);
    perfMonitor.userId = userId;

    // Check daily message limit
    const messageLimit = await checkDailyMessageLimit(userId);

    // Block not-whitelisted users (pending approval)
    if (messageLimit.rank === "not_whitelisted") {
      routeLogger.warn(`Access denied - user pending approval: ${userId}`);
      perfMonitor.end(403, { pendingApproval: true });
      return new Response(
        JSON.stringify({
          error: "Access Pending Approval",
          message:
            "Your account is pending admin approval. Please wait for an administrator to grant you access.",
          rank: "not_whitelisted",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!messageLimit.canSend) {
      routeLogger.warn(
        `Daily message limit reached for user: ${userId} (${messageLimit.count}/${messageLimit.limit})`
      );
      perfMonitor.end(429, { dailyLimitReached: true });
      return new Response(
        JSON.stringify({
          error: "Daily message limit reached",
          count: messageLimit.count,
          limit: messageLimit.limit,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rl = await consumeRateLimit(`chat-stream:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for user: ${userId}`);
      perfMonitor.end(429, { rateLimited: true });
      return rateLimitError("Rate limit exceeded", rl.retryAfterSeconds);
    }

    const response = await handleChatStreamCore({ req, userId });

    // Increment daily message count after successful stream initiation
    try {
      await incrementDailyMessageCount(userId);
    } catch (err) {
      routeLogger.error("Failed to increment message count:", err);
    }

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
