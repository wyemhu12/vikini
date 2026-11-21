import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  AppError,
} from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";
import { removeOwnedStoragePaths } from "@/lib/features/chat/storageCleanup";

const routeLogger = logger.withContext("DELETE /api/gallery/[id]");

interface MessageMeta {
  attachment?: {
    storagePath?: string;
  };
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    const { id: messageId } = await params;

    if (!messageId) {
      throw new ValidationError("Missing message ID");
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch the message and verify ownership via conversation
    const { data: msg, error: fetchError } = await supabase
      .from("messages")
      .select(
        `
                id,
                meta,
                conversation_id,
                conversations!messages_conversation_id_fkey!inner (
                    user_id
                )
            `
      )
      .eq("id", messageId)
      .single();

    if (fetchError || !msg) {
      throw new NotFoundError("Message");
    }

    // Type assertion for joined data
    const conversation = msg.conversations as unknown as { user_id: string };

    if (conversation.user_id !== userId) {
      throw new ForbiddenError("You don't have permission to delete this message");
    }

    // 3. Delete the message from DB first so storage is never removed for a failed DB delete
    const { error: deleteError } = await supabase.from("messages").delete().eq("id", messageId);

    if (deleteError) {
      throw deleteError;
    }

    // 4. Best-effort delete from storage if storagePath exists and belongs to user
    const meta = msg.meta as MessageMeta | null;
    if (meta?.attachment?.storagePath) {
      try {
        await removeOwnedStoragePaths(supabase, userId, [meta.attachment.storagePath]);
      } catch (storageErr: unknown) {
        routeLogger.warn("Best-effort storage cleanup failed after DB delete:", storageErr);
      }
    }

    return success({ deleted: true });
  } catch (err: unknown) {
    routeLogger.error("Delete error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete", 500);
  }
}
