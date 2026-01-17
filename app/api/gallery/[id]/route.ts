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
                conversations!inner (
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

    // 3. Delete from storage if storagePath exists
    const meta = msg.meta as MessageMeta | null;
    if (meta?.attachment?.storagePath) {
      const storagePath = meta.attachment.storagePath;
      const { error: storageError } = await supabase.storage
        .from("attachments")
        .remove([storagePath]);

      if (storageError) {
        console.error("Failed to delete from storage:", storageError);
        // Continue with message deletion even if storage deletion fails
      }
    }

    // 4. Delete the message
    const { error: deleteError } = await supabase.from("messages").delete().eq("id", messageId);

    if (deleteError) {
      throw deleteError;
    }

    return success({ deleted: true });
  } catch (err: unknown) {
    console.error("Delete error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete", 500);
  }
}
