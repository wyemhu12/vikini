// /lib/features/chat/messages.js
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { getConversationSafe } from "./conversations";

// ------------------------------
// Row mappers
// ------------------------------
export function mapMessageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

// ------------------------------
// Messages
// ------------------------------
export async function saveMessage(userId, conversationId, role, content) {
  const supabase = getSupabaseAdmin();

  // Verify conversation ownership
  const convo = await getConversationSafe(conversationId);
  if (!convo) throw new Error("Conversation not found");
  if (convo.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`saveMessage failed: ${error.message}`);
  return mapMessageRow(data);
}

export async function deleteLastAssistantMessage(userId, conversationId) {
  const supabase = getSupabaseAdmin();

  const convo = await getConversationSafe(conversationId);
  if (!convo) throw new Error("Conversation not found");
  if (convo.userId !== userId) throw new Error("Forbidden");

  const { data: rows, error: findErr } = await supabase
    .from("messages")
    .select("id,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1);

  if (findErr) throw new Error(`deleteLastAssistantMessage find failed: ${findErr.message}`);
  const target = rows?.[0];
  if (!target) return { ok: true, deleted: false };

  const { error: delErr } = await supabase.from("messages").delete().eq("id", target.id);
  if (delErr) throw new Error(`deleteLastAssistantMessage delete failed: ${delErr.message}`);

  return { ok: true, deleted: true };
}

export async function getMessages(conversationId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getMessages failed: ${error.message}`);
  return (data || []).map(mapMessageRow);
}
