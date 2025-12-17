// /lib/postgresChat.js
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function mapConversationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessagePreview: row.last_message_preview,
    gemId: row.gem_id || null,
    gem: row.gems
      ? {
          name: row.gems.name,
          icon: row.gems.icon,
          color: row.gems.color,
        }
      : null,
  };
}

function mapMessageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function listConversations(userId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listConversations failed: ${error.message}`);
  return (data || []).map(mapConversationRow);
}

export async function getConversation(id) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getConversation failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function saveConversation(userId, { title = "New Chat", createdAt = Date.now() } = {}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date().toISOString(),
      last_message_preview: null,
    })
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`saveConversation failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function saveMessage({ conversationId, userId, role, content }) {
  const supabase = getSupabaseAdmin();

  // enforce ownership
  const current = await getConversation(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // Update last_message_preview (truncate)
  const preview = String(content || "").slice(0, 140);

  // transaction-like sequence
  const { error: insertErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
  });

  if (insertErr) throw new Error(`saveMessage insert failed: ${insertErr.message}`);

  const { error: updErr } = await supabase
    .from("conversations")
    .update({ last_message_preview: preview, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (updErr) throw new Error(`saveMessage update conv failed: ${updErr.message}`);

  return { ok: true };
}

export async function deleteLastAssistantMessage(userId, conversationId) {
  const supabase = getSupabaseAdmin();

  // enforce ownership
  const current = await getConversation(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data: rows, error: findErr } = await supabase
    .from("messages")
    .select("id,content,created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1);

  if (findErr) throw new Error(`deleteLastAssistantMessage find failed: ${findErr.message}`);
  const target = rows?.[0];
  if (!target?.id) return { ok: true, deleted: false };

  const { error: delErr } = await supabase.from("messages").delete().eq("id", target.id);

  if (delErr) throw new Error(`deleteLastAssistantMessage delete failed: ${delErr.message}`);

  // Refresh last_message_preview to match the new last message (if any)
  const { data: lastRows, error: lastErr } = await supabase
    .from("messages")
    .select("content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (lastErr) throw new Error(`deleteLastAssistantMessage last msg failed: ${lastErr.message}`);

  const lastContent = lastRows?.[0]?.content ?? "";
  const preview = lastContent ? String(lastContent).slice(0, 140) : null;

  const { error: updErr } = await supabase
    .from("conversations")
    .update({
      last_message_preview: preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (updErr) throw new Error(`deleteLastAssistantMessage update conv failed: ${updErr.message}`);

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

export async function renameConversation(userId, id, title) {
  const supabase = getSupabaseAdmin();

  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`renameConversation failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function setConversationAutoTitle(userId, id, title) {
  const supabase = getSupabaseAdmin();

  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`setConversationAutoTitle failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function setConversationGem(userId, conversationId, gemId) {
  const supabase = getSupabaseAdmin();

  const current = await getConversation(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("conversations")
    .update({ gem_id: gemId || null, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .single();

  if (error) throw new Error(`setConversationGem failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function listGems() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("gems")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`listGems failed: ${error.message}`);
  return data || [];
}

export async function getGemInstructionsForUser(userId) {
  const supabase = getSupabaseAdmin();

  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("gem_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convoErr) throw new Error(`getGemInstructionsForUser convo failed: ${convoErr.message}`);

  const gemId = convo?.gem_id;
  if (!gemId) return "";

  const { data: gem, error: gemErr } = await supabase
    .from("gems")
    .select("instruction")
    .eq("id", gemId)
    .maybeSingle();

  if (gemErr) throw new Error(`getGemInstructionsForUser gem failed: ${gemErr.message}`);
  return gem?.instruction || "";
}
