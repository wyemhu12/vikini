// /lib/postgresChat.js
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (Service Role)
 * IMPORTANT:
 * - Chỉ dùng ở runtime = nodejs (API routes/server actions)
 * - KHÔNG expose SUPABASE_SERVICE_ROLE_KEY ra client
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toMillis(isoOrDate) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function mapConversationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
    lastMessagePreview: row.last_message_preview ?? null,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: toMillis(row.created_at),
  };
}

export async function getUserConversations(userId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`getUserConversations failed: ${error.message}`);
  return (data || []).map(mapConversationRow);
}

export async function saveConversation(userId, data = {}) {
  const supabase = getSupabaseAdmin();

  // Create new conversation
  if (!data.id) {
    const nowIso = new Date().toISOString();
    const payload = {
      user_id: userId,
      title: data.title || "New Chat",
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error } = await supabase
      .from("conversations")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw new Error(`saveConversation(insert) failed: ${error.message}`);
    return mapConversationRow(inserted);
  }

  // Update existing conversation (merge-like)
  const nowIso = new Date().toISOString();
  const patch = {
    user_id: userId,
    title: data.title || "New Chat",
    updated_at: nowIso,
  };

  const { data: updated, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", data.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`saveConversation(update) failed: ${error.message}`);
  return mapConversationRow(updated);
}

export async function getConversation(id) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getConversation failed: ${error.message}`);
  return data ? mapConversationRow(data) : null;
}

export async function updateConversationTitle(id, title) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: nowIso })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`updateConversationTitle failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function setConversationAutoTitle(userId, id, title) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // enforce ownership
  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: nowIso })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`setConversationAutoTitle failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function deleteConversation(userId, id) {
  const supabase = getSupabaseAdmin();

  // enforce ownership
  const current = await getConversation(id);
  if (!current) return;
  if (current.userId !== userId) throw new Error("Forbidden");

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteConversation failed: ${error.message}`);
}

export async function saveMessage({ conversationId, userId, role, content }) {
  if (!conversationId || !role || !content) {
    throw new Error("Invalid params");
  }

  const supabase = getSupabaseAdmin();

  const conv = await getConversation(conversationId);
  if (!conv) throw new Error("Conversation not found");
  if (userId && conv.userId !== userId) throw new Error("Forbidden");

  const nowIso = new Date().toISOString();

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      created_at: nowIso,
    })
    .select("*")
    .single();

  if (msgErr) throw new Error(`saveMessage(insert) failed: ${msgErr.message}`);

  const preview = content.slice(0, 200);

  const { error: convErr } = await supabase
    .from("conversations")
    .update({
      updated_at: nowIso,
      last_message_preview: preview,
    })
    .eq("id", conversationId)
    .eq("user_id", conv.userId);

  if (convErr) throw new Error(`saveMessage(update conversation) failed: ${convErr.message}`);

  return mapMessageRow(msg);
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
