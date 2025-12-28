// lib/features/chat/messages.ts
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { encryptText, decryptText } from "@/lib/core/encryption";
import { logger } from "@/lib/utils/logger";

const messagesLogger = logger.withContext("messages");

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string | null;
  meta: Record<string, unknown>;
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

export async function getRecentMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
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

export async function deleteLastAssistantMessage(userId: string, conversationId: string): Promise<void> {
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

  // 2. Delete target message and everything created after it in this conversation
  // Note: Using gte (>=) to include the message itself.
  await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gte("created_at", targetMsg.created_at);
}

