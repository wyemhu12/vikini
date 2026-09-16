// /app/api/conversations/[id]/branch/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { parseJsonBody, branchConversationSchema } from "@/app/api/conversations/validators";
import { branchConversation } from "@/lib/features/chat/conversations";
import { logger } from "@/lib/utils/logger";
import { AppError, ValidationError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { createPerformanceMonitor } from "@/lib/utils/performance";

const routeLogger = logger.withContext("/api/conversations/[id]/branch");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const perfMonitor = createPerformanceMonitor("/api/conversations/[id]/branch", "POST");

  try {
    const { id: sourceConversationId } = await params;

    const auth = await requireUser(req);
    if (!auth.ok) {
      perfMonitor.end(auth.response.status);
      return auth.response;
    }
    const { userId } = auth;
    perfMonitor.userId = userId;

    if (!sourceConversationId || !UUID_REGEX.test(sourceConversationId)) {
      routeLogger.warn(`Invalid conversation UUID format: ${sourceConversationId}`);
      perfMonitor.end(400, { error: "invalid-uuid" });
      return errorFromAppError(new ValidationError("Invalid conversation ID format"));
    }

    const body = await parseJsonBody(req);
    const parsed = branchConversationSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || "Invalid payload";
      perfMonitor.end(400, { error: "validation-failed" });
      return errorFromAppError(new ValidationError(issue));
    }

    const { messageId, titlePrefix } = parsed.data;

    const newConversation = await branchConversation(
      userId,
      sourceConversationId,
      messageId,
      titlePrefix
    );

    perfMonitor.end(200, {
      sourceConversationId,
      newConversationId: newConversation.id,
      messageId,
    });

    return success({
      conversation: newConversation,
      conversationId: newConversation.id,
    });
  } catch (err: unknown) {
    routeLogger.error("POST branch error:", err);
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    return error("Failed to branch conversation", 500);
  }
}
