import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 1. Auth Check
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.email.toLowerCase();

  const { id: messageId } = await params;

  if (!messageId) {
    return NextResponse.json({ error: "Missing message ID" }, { status: 400 });
  }

  try {
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
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Type assertion for joined data
    const conversation = msg.conversations as unknown as { user_id: string };

    if (conversation.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 3. Delete from storage if storagePath exists
    const meta = msg.meta as Record<string, any> | null;
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
