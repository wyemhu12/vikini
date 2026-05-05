/**
 * Files API — Upload
 * POST /api/files/upload — FormData upload with dual storage
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { uploadFile } from "@/lib/features/files/fileService.server";
import { logger } from "@/lib/utils/logger";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/files/upload");

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

    const result = await uploadFile({
      userId,
      conversationId,
      messageId,
      file,
      filename: file.name,
    });

    return success({
      file: {
        id: result.file.id,
        filename: result.file.filename,
        size_bytes: result.file.size_bytes,
        mime_type: result.file.mime_type,
        kind: result.file.kind,
        created_at: result.file.created_at,
        conversation_id: result.file.conversation_id,
        gemini_ready: result.geminiReady,
      },
    });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error(err instanceof Error ? err.message : "Upload failed", 500);
  }
}
