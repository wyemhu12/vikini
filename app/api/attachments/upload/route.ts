// /app/api/attachments/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { uploadAttachment } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/attachments/upload");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const form = await req.formData();

    const conversationId = String(form.get("conversationId") || "").trim();
    const messageIdRaw = form.get("messageId");
    const messageId = messageIdRaw ? String(messageIdRaw).trim() : null;

    const file = form.get("file");
    if (!conversationId) {
      throw new ValidationError("Missing conversationId");
    }
    if (!file || !(file instanceof File)) {
      throw new ValidationError("Missing file");
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation");
    }

    const attachment = await uploadAttachment({
      userId,
      conversationId,
      messageId,
      file,
      filename: file.name,
    });

    return success({ attachment });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Upload failed", 500);
  }
}
