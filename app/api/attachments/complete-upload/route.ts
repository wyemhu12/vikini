export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { verifyAndCreateAttachment } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/attachments/complete-upload");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const json = await req.json().catch(() => ({}));

    const conversationId = String(json.conversationId || "").trim();
    const path = String(json.path || "").trim();
    const filename = String(json.filename || "").trim();
    const sizeBytes = Number(json.sizeBytes || 0);
    const mimeType = String(json.mimeType || "").trim();

    if (!conversationId || !path || !filename) {
      throw new ValidationError("Missing required fields");
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation");
    }

    const attachment = await verifyAndCreateAttachment({
      userId,
      conversationId,
      path,
      filename,
      sizeBytes,
      mimeType,
    });

    return success({ attachment });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Complete upload failed", 500);
  }
}
