import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { AppError, NotFoundError, ForbiddenError } from "@/lib/utils/errors";

const routeLogger = logger.withContext("/api/messages/[id]/favorite");

/**
 * PATCH /api/messages/[id]/favorite
 * Toggle is_favorite in message meta JSONB.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const supabase = getSupabaseAdmin();

    // 1. Fetch message and verify ownership via conversation
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, conversation_id, meta")
      .eq("id", id)
      .single();

    if (msgError || !message) {
      throw new NotFoundError("Message");
    }

    // Verify user owns the conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", message.conversation_id)
      .single();

    if (convError || !conv || conv.user_id !== userId) {
      throw new ForbiddenError("Not your message");
    }

    // 2. Toggle is_favorite in meta JSONB
    const currentMeta = (message.meta as Record<string, unknown>) || {};
    const newFavorite = !currentMeta.is_favorite;

    const { error: updateError } = await supabase
      .from("messages")
      .update({
        meta: { ...currentMeta, is_favorite: newFavorite },
      })
      .eq("id", id);

    if (updateError) {
      routeLogger.error("Failed to update favorite:", updateError);
      throw new AppError("Failed to update favorite", 500);
    }

    routeLogger.info(`Toggled favorite for message ${id}: ${newFavorite}`);
    return success({ isFavorite: newFavorite });
  } catch (err: unknown) {
    routeLogger.error("PATCH favorite error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Internal error", 500);
  }
}
