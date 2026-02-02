export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { createSignedUploadUrl } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/attachments/sign-upload");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const json = await req.json().catch(() => ({}));

    const conversationId = String(json.conversationId || "").trim();
    const filename = String(json.filename || "").trim();
    const fileType = String(json.fileType || "").trim();
    const fileSize = Number(json.fileSize || 0);

    if (!conversationId) {
      throw new ValidationError("Missing conversationId");
    }
    if (!filename || !fileSize) {
      throw new ValidationError("Missing file metadata");
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      throw new NotFoundError("Conversation");
    }

    const result = await createSignedUploadUrl({
      userId,
      conversationId,
      filename,
      fileType,
      fileSize,
    });

    return success(result);
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Sign upload failed", 500);
  }
}
