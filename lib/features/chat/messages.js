// lib/features/chat/messages.js
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { encryptText, decryptText } from "@/lib/core/encryption";

function mapMessageRow(row) {
  if (!row) return null;
  
  // Safe Decrypt: Không bao giờ crash khi map dữ liệu
  let content = row.content;
  try {
    content = decryptText(row.content);
  } catch (e) {
    console.warn("Map Error:", e);
  }

  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId,
    role: row.role,
    content: content,
    createdAt: row.created_at ?? row.createdAt,
    meta: row.meta || {},
  };
}

export async function saveMessage(userId, conversationId, role, content, meta = {}) {
  const supabase = getSupabaseAdmin();

  // 1. Safe Encrypt
  let contentToSave = content;
  try {
    const encrypted = encryptText(content);
    if (encrypted) contentToSave = encrypted;
  } catch (e) {
    console.error("Encrypt failed in saveMessage:", e);
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
    console.error("[Supabase Error] saveMessage:", error);
    throw new Error(error.message);
  }

  return mapMessageRow(data);
}

// Giữ nguyên các hàm Get/Delete cũ nhưng đảm bảo dùng mapMessageRow
export async function getMessages(conversationId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map(mapMessageRow);
}

export async function getRecentMessages(conversationId, limit = 50) {
  const supabase = getSupabaseAdmin();
  const n = Number(limit) > 0 ? Number(limit) : 50;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(n);

  if (error) throw new Error(error.message);

  const rows = (data || []).map(mapMessageRow);
  rows.reverse();
  return rows;
}

export async function deleteLastAssistantMessage(userId, conversationId) {
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

export async function deleteMessage(userId, messageId) {
  const supabase = getSupabaseAdmin();
  await supabase.from("messages").delete().eq("id", messageId);
}

export async function deleteMessagesIncludingAndAfter(userId, conversationId, messageId) {
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
