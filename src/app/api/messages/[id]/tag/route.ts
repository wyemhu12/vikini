import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { AppError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/utils/errors";

const routeLogger = logger.withContext("/api/messages/[id]/tag");

/**
 * PATCH /api/messages/[id]/tag
 * Update tags on a message. Body: { tags: string[] }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authResult = await requireUser(req);
    if (!authResult.ok) return authResult.response;
    const { userId } = authResult;

    // Parse body
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("tags" in body)) {
      throw new ValidationError("tags array is required");
    }
    const tags = (body as Record<string, unknown>).tags;
    if (!Array.isArray(tags) || tags.length > 5) {
      throw new ValidationError("tags must be an array of max 5 strings");
    }
    // Validate each tag
    const cleanTags = tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase().slice(0, 30))
      .filter((t) => t.length > 0);

    const supabase = getSupabaseAdmin();

    // 1. Fetch message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, conversation_id, meta")
      .eq("id", id)
      .single();

    if (msgError || !message) {
      throw new NotFoundError("Message");
    }

    // 2. Verify user owns the conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", message.conversation_id)
      .single();

    if (convError || !conv || conv.user_id !== userId) {
      throw new ForbiddenError("Not your message");
    }

    // 3. Update meta.tags
    const currentMeta = (message.meta as Record<string, unknown>) || {};
    const updatedMeta = { ...currentMeta, tags: cleanTags };

    const { error: updateError } = await supabase
      .from("messages")
      .update({ meta: updatedMeta })
      .eq("id", id);

    if (updateError) {
      routeLogger.error("Failed to update tags:", updateError);
      throw new AppError("Failed to update tags", 500);
    }

    routeLogger.info(`Updated tags for message ${id}: [${cleanTags.join(", ")}]`);
    return success({ tags: cleanTags });
  } catch (err: unknown) {
    routeLogger.error("PATCH tag error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update tags", 500);
  }
}
