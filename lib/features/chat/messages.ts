// lib/features/chat/messages.ts
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { encryptText, decryptText } from "@/lib/core/encryption";
import { logger } from "@/lib/utils/logger";

const messagesLogger = logger.withContext("messages");

/**
 * Typed metadata for messages - used for image generation and other features.
 * Avoids `any` type for type safety.
 */
export interface MessageMeta {
  type?: "image_gen" | "text" | "chart";
  imageUrl?: string;
  prompt?: string;
  attachment?: {
    storagePath: string;
    mimeType?: string;
    filename?: string;
  };
  thoughtSignature?: string; // Gemini 3 thought signature for reasoning continuity
  [key: string]: unknown; // Allow additional properties
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string | null;
  meta: MessageMeta;
}

interface MessageRow {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  role: string;
  content: string;
  created_at?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

function mapMessageRow(row: MessageRow | null): Message | null {
  if (!row) return null;

  // Safe Decrypt: Không bao giờ crash khi map dữ liệu
  let content = row.content;
  try {
    content = decryptText(row.content);
  } catch (e) {
    messagesLogger.warn("Map Error:", e);
  }

  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId ?? "",
    role: row.role,
    content: content,
    createdAt: row.created_at ?? row.createdAt ?? null,
    meta: row.meta || {},
  };
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  role: string,
  content: string,
  meta: Record<string, unknown> = {}
): Promise<Message | null> {
  const supabase = getSupabaseAdmin();

  // 1. Safe Encrypt
  let contentToSave = content;
  try {
    const encrypted = encryptText(content);
    if (encrypted) contentToSave = encrypted;
  } catch (e) {
    messagesLogger.error("Encrypt failed in saveMessage:", e);
  }

  // 2. Insert DB with Logging
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content: contentToSave,
      meta,
    })
    .select("*")
    .single();

  if (error) {
    // In lỗi chi tiết ra Log Vercel để bạn debug nếu cần
    messagesLogger.error("[Supabase Error] saveMessage:", error);
    throw new Error(error.message);
  }

  return mapMessageRow(data);
}

// Giữ nguyên các hàm Get/Delete cũ nhưng đảm bảo dùng mapMessageRow
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(mapMessageRow).filter((m): m is Message => m !== null);
}

export async function getRecentMessages(
  conversationId: string,
  limit: number = 50
): Promise<Message[]> {
  const supabase = getSupabaseAdmin();
  const n = Number(limit) > 0 ? Number(limit) : 50;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);

  const rows = (data || []).map(mapMessageRow).filter((m): m is Message => m !== null);
  rows.reverse();
  return rows;
}

export async function deleteLastAssistantMessage(
  userId: string,
  conversationId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMsg) {
    await supabase.from("messages").delete().eq("id", lastMsg.id);
  }
}

export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch message meta to check for generated images
  const { data: msg } = await supabase.from("messages").select("meta").eq("id", messageId).single();

  if (msg?.meta) {
    const meta = msg.meta as MessageMeta;
    // Check if it's a generated image with a storage path
    if (meta.type === "image_gen" && meta.attachment?.storagePath) {
      const storagePath = meta.attachment.storagePath;
      messagesLogger.info(`Deleting generated image from storage: ${storagePath}`);
      await supabase.storage.from("attachments").remove([storagePath]);
    }
  }

  // 2. Delete message from DB
  await supabase.from("messages").delete().eq("id", messageId);
}

export async function deleteMessagesIncludingAndAfter(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  // 1. Get target message to find its creation time
  const { data: targetMsg } = await supabase
    .from("messages")
    .select("created_at")
    .eq("id", messageId)
    .eq("conversation_id", conversationId) // Ensure it belongs to the convo
    .maybeSingle();

  if (!targetMsg) return;

  // 2. Identify messages with generated images to clean up
  const { data: messagesToDelete } = await supabase
    .from("messages")
    .select("meta")
    .eq("conversation_id", conversationId)
    .gte("created_at", targetMsg.created_at);

  if (messagesToDelete && messagesToDelete.length > 0) {
    const pathsToRemove: string[] = [];

    for (const msg of messagesToDelete) {
      const meta = msg.meta as MessageMeta;
      if (meta?.type === "image_gen" && meta?.attachment?.storagePath) {
        pathsToRemove.push(meta.attachment.storagePath);
      }
    }

    if (pathsToRemove.length > 0) {
      messagesLogger.info(`Deleting ${pathsToRemove.length} generated images from storage`);
      await supabase.storage.from("attachments").remove(pathsToRemove);
    }
  }

  // 3. Delete target message and everything created after it in this conversation
  // Note: Using gte (>=) to include the message itself.
  await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gte("created_at", targetMsg.created_at);
}
// ... existing code ...

/**
 * Deletes a SINGLE message by ID.
 * Used for Gallery/Studio mode where we don't want to wipe future history.
 */
export async function deleteSingleMessage(userId: string, messageId: string) {
  const supabase = getSupabaseAdmin();

  // Verify ownership matches by joining with conversations table
  // Since we are using admin client, we MUST manually verify user_id of the conversation
  const { data: msg, error } = await supabase
    .from("messages")
    .select("conversation_id, meta, conversations!inner(user_id)")
    .eq("id", messageId)
    .single();

  if (error || !msg) {
    messagesLogger.error("deleteSingleMessage Fetch Error:", error);
    throw new Error("Message not found");
  }

  // Type assertion for joined data
  const conversation = msg.conversations as unknown as { user_id: string };

  if (conversation.user_id !== userId) {
    messagesLogger.error(
      `deleteSingleMessage Unauthorized: ReqUser=${userId} vs ConvUser=${conversation.user_id}`
    );
    throw new Error("Unauthorized or message not found");
  }

  // 1. Delete Storage File if exists
  if (msg.meta?.imageUrl) {
    const path = msg.meta.imageUrl.split("/storage/v1/object/public/images/").pop();
    if (path) {
      await supabase.storage.from("images").remove([path]);
    }
  }

  // 2. Delete Record
  await supabase.from("messages").delete().eq("id", messageId);
}
