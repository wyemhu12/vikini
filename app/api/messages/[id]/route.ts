import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { deleteMessage } from "@/lib/features/chat/messages";
import { logger } from "@/lib/utils/logger";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { AppError, ValidationError } from "@/lib/utils/errors";

const routeLogger = logger.withContext("/api/messages/[id]");

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    if (!id) {
      throw new ValidationError("Missing ID");
    }

    await deleteMessage(userId, id);

    routeLogger.info(`Deleted message ${id} for user: ${userId}`);

    return success({ success: true });
  } catch (err: unknown) {
    routeLogger.error("DELETE message error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Internal error", 500);
  }
}
