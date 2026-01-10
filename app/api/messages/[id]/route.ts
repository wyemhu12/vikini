import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { deleteMessage } from "@/lib/features/chat/messages";
import { logger } from "@/lib/utils/logger";
import { errorFromAppError } from "@/lib/utils/apiResponse";
import { AppError } from "@/lib/utils/errors";
import { HTTP_STATUS } from "@/lib/utils/constants";

const routeLogger = logger.withContext("/api/messages/[id]");

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    await deleteMessage(userId, id);

    routeLogger.info(`Deleted message ${id} for user: ${userId}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    routeLogger.error("DELETE message error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
