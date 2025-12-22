// /lib/features/chat/conversations.js
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { deleteAttachmentsByConversation } from "@/lib/features/attachments/attachments";

// ------------------------------
// Row mappers
// ------------------------------
export function mapConversationRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? row.user ?? row.owner ?? row.created_by ?? "",
    title: row.title ?? "New Chat",
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    lastMessagePreview: row.last_message_preview ?? row.lastMessagePreview ?? null,
    gemId: row.gem_id ?? row.gemId ?? null,
    gem: row.gems
      ? {
          name: row.gems.name,
          icon: row.gems.icon,
          color: row.gems.color,
        }
      : null,
  };
}

export async function getConversationSafe(conversationId) {
  const supabase = getSupabaseAdmin();

  // Try join on gems (supabase can join by relationship)
  const q1 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!q1.error) return mapConversationRow(q1.data);

  // Fallback: no relation or join not supported
  const q2 = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
  if (q2.error) throw new Error(`getConversation failed: ${q2.error.message}`);
  return mapConversationRow(q2.data);
}

async function listConversationsSafe(userId) {
  const supabase = getSupabaseAdmin();

  // Try primary schema: user_id
  const q1 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!q1.error) return (q1.data || []).map(mapConversationRow);

  // Fallback schema: userId
  const q2 = await supabase
    .from("conversations")
    .select("*,gems(name,icon,color)")
    .eq("userId", userId)
    .order("updated_at", { ascending: false });

  if (q2.error) throw new Error(`listConversations failed: ${q2.error.message}`);
  return (q2.data || []).map(mapConversationRow);
}

// ------------------------------
// Conversations
// ------------------------------
export async function getConversation(conversationId) {
  return getConversationSafe(conversationId);
}

export async function saveConversation(userId, payload) {
  const supabase = getSupabaseAdmin();
  const title = typeof payload?.title === "string" ? payload.title : "New Chat";
  const now = new Date().toISOString();

  const attempt1 = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      created_at: now,
      updated_at: now,
      last_message_preview: payload?.lastMessagePreview ?? null,
      gem_id: payload?.gemId ?? null,
    })
    .select("*")
    .single();

  if (!attempt1.error) return mapConversationRow(attempt1.data);

  // Fallback
  const attempt2 = await supabase
    .from("conversations")
    .insert({
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: payload?.lastMessagePreview ?? null,
      gemId: payload?.gemId ?? null,
    })
    .select("*")
    .single();

  if (attempt2.error) throw new Error(`saveConversation failed: ${attempt2.error.message}`);
  return mapConversationRow(attempt2.data);
}

export async function setConversationGem(userId, conversationId, gemId) {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { error } = await supabase
    .from("conversations")
    .update({ gem_id: gemId || null, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw new Error(`setConversationGem failed: ${error.message}`);
  return getConversationSafe(conversationId);
}

export async function renameConversation(userId, id, title) {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`renameConversation failed: ${error.message}`);
  return getConversationSafe(id);
}

export async function deleteConversation(userId, conversationId) {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // Delete attachments (storage + db) before deleting conversation row
  await deleteAttachmentsByConversation({ userId, conversationId });

  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error(`deleteConversation failed: ${error.message}`);

  return { ok: true };
}

// ------------------------------
// Compatibility exports (expected by your routes)
// ------------------------------
export async function getUserConversations(userId) {
  return listConversationsSafe(userId);
}

export async function updateConversationTitle(userId, conversationId, title) {
  return renameConversation(userId, conversationId, title);
}

export async function setConversationAutoTitle(userId, id, title) {
  // same as renameConversation but kept for semantic clarity
  return renameConversation(userId, id, title);
}
