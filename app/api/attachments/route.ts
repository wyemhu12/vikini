// /app/api/attachments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import {
  listAttachmentsForConversation,
  deleteAttachmentById,
  deleteAttachmentsByConversation,
} from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/attachments");

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) {
      throw new ValidationError("Missing conversationId");
    }

    const attachments = await listAttachmentsForConversation({ userId, conversationId });
    return success({ attachments });
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list attachments", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);

    const conversationId = url.searchParams.get("conversationId");
    let id = url.searchParams.get("id");

    // Try to get id from request body if not in query params
    if (!id) {
      try {
        const body = (await req.json()) as { id?: string };
        id = body?.id || "";
      } catch {
        // Ignore JSON parse errors - id might be in query params only
      }
    }

    // DELETE all attachments in conversation (used by Files menu)
    if (!id && conversationId) {
      await deleteAttachmentsByConversation({ userId, conversationId });
      return success({ ok: true });
    }

    // Missing both id and conversationId - error
    if (!id) {
      throw new ValidationError("Missing id or conversationId");
    }

    // DELETE single attachment by id
    await deleteAttachmentById({ userId, id });
    return success({ ok: true });
  } catch (err: unknown) {
    routeLogger.error("DELETE error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete attachment", 500);
  }
}
