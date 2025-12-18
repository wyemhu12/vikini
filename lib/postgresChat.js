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

// ------------------------------
// Conversations (with safe join fallback)
// ------------------------------
const CONVO_SELECT_WITH_GEM =
  "id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)";
const CONVO_SELECT_BASE =
  "id,user_id,title,created_at,updated_at,last_message_preview,gem_id";

async function listConversationsSafe(userId) {
  const supabase = getSupabaseAdmin();

  // Try with join first
  const first = await supabase
    .from("conversations")
    .select(CONVO_SELECT_WITH_GEM)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!first.error) return (first.data || []).map(mapConversationRow);

  // Fallback without join (handles missing FK relationship)
  const second = await supabase
    .from("conversations")
    .select(CONVO_SELECT_BASE)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (second.error) {
    throw new Error(`listConversations failed: ${second.error.message}`);
  }

  return (second.data || []).map(mapConversationRow);
}

async function getConversationSafe(id) {
  const supabase = getSupabaseAdmin();

  const first = await supabase
    .from("conversations")
    .select(CONVO_SELECT_WITH_GEM)
    .eq("id", id)
    .maybeSingle();

  if (!first.error) return mapConversationRow(first.data);

  const second = await supabase
    .from("conversations")
    .select(CONVO_SELECT_BASE)
    .eq("id", id)
    .maybeSingle();

  if (second.error) throw new Error(`getConversation failed: ${second.error.message}`);
  return mapConversationRow(second.data);
}

export async function listConversations(userId) {
  return listConversationsSafe(userId);
}

export async function getConversation(id) {
  return getConversationSafe(id);
}

export async function saveConversation(userId, { title = "New Chat", createdAt = Date.now() } = {}) {
  const supabase = getSupabaseAdmin();

  // Insert and only return id; then fetch with safe getter (avoids join errors on insert .select)
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date().toISOString(),
      last_message_preview: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`saveConversation failed: ${error.message}`);
  return getConversationSafe(data.id);
}

export async function saveMessage({ conversationId, userId, role, content }) {
  const supabase = getSupabaseAdmin();

  // enforce ownership
  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const preview = String(content || "").slice(0, 140);

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

  const current = await getConversationSafe(conversationId);
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

export async function setConversationAutoTitle(userId, id, title) {
  // same as renameConversation but kept for semantic clarity
  return renameConversation(userId, id, title);
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

// ------------------------------
// Gems
// ------------------------------
function normalizeGemPayload(payload) {
  const body = payload || {};
  // route uses `instructions`, but older code used `instruction`
  const instruction =
    typeof body.instructions === "string"
      ? body.instructions
      : typeof body.instruction === "string"
        ? body.instruction
        : "";

  return {
    name: typeof body.name === "string" ? body.name : "New GEM",
    description: typeof body.description === "string" ? body.description : "",
    instruction,
    icon: typeof body.icon === "string" ? body.icon : body.icon ?? "",
    color: typeof body.color === "string" ? body.color : body.color ?? "",
  };
}

export async function listGems() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("gems").select("*").order("name", { ascending: true });
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

  // Try both column names to be resilient: instruction vs instructions
  const { data: gem, error: gemErr } = await supabase
    .from("gems")
    .select("instruction,instructions")
    .eq("id", gemId)
    .maybeSingle();

  if (gemErr) throw new Error(`getGemInstructionsForUser gem failed: ${gemErr.message}`);

  const ins =
    (typeof gem?.instruction === "string" && gem.instruction) ||
    (typeof gem?.instructions === "string" && gem.instructions) ||
    "";

  return ins;
}

// ------------------------------
// Compatibility exports (expected by your routes)
// ------------------------------

// /api/conversations uses these names :contentReference[oaicite:4]{index=4}
export async function getUserConversations(userId) {
  return listConversationsSafe(userId);
}

export async function updateConversationTitle(userId, conversationId, title) {
  return renameConversation(userId, conversationId, title);
}

export async function deleteConversation(userId, conversationId) {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error(`deleteConversation failed: ${error.message}`);

  return { ok: true };
}

// /api/gems uses these names :contentReference[oaicite:5]{index=5}
export async function getGemsForUser(userId) {
  const supabase = getSupabaseAdmin();

  // Prefer “my gems”, but fall back to “all gems” if schema doesn't have user_id
  const q1 = await supabase.from("gems").select("*").eq("user_id", userId).order("name", { ascending: true });
  if (!q1.error) return q1.data || [];

  const q2 = await supabase.from("gems").select("*").order("name", { ascending: true });
  if (q2.error) throw new Error(`getGemsForUser failed: ${q2.error.message}`);
  return q2.data || [];
}

export async function createGem(userId, payload) {
  const supabase = getSupabaseAdmin();
  const body = normalizeGemPayload(payload);

  // Try insert with user_id first, then fallback without user_id if column doesn't exist
  const attempt1 = await supabase
    .from("gems")
    .insert({
      user_id: userId,
      name: body.name,
      description: body.description,
      instruction: body.instruction,
      icon: body.icon,
      color: body.color,
    })
    .select("*")
    .single();

  if (!attempt1.error) return attempt1.data;

  const attempt2 = await supabase
    .from("gems")
    .insert({
      name: body.name,
      description: body.description,
      instruction: body.instruction,
      icon: body.icon,
      color: body.color,
    })
    .select("*")
    .single();

  if (attempt2.error) throw new Error(`createGem failed: ${attempt2.error.message}`);
  return attempt2.data;
}

export async function updateGem(userId, gemId, payload) {
  const supabase = getSupabaseAdmin();
  const body = normalizeGemPayload(payload);

  const patch = {
    ...(payload || {}),
    // normalize instruction field
    instruction: body.instruction,
    instructions: undefined, // prevent accidental column mismatch if caller sends both
  };

  // Try enforce user_id first, fallback if schema lacks user_id
  const attempt1 = await supabase
    .from("gems")
    .update(patch)
    .eq("id", gemId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (!attempt1.error) return attempt1.data;

  const attempt2 = await supabase
    .from("gems")
    .update(patch)
    .eq("id", gemId)
    .select("*")
    .single();

  if (attempt2.error) throw new Error(`updateGem failed: ${attempt2.error.message}`);
  return attempt2.data;
}

export async function deleteGem(userId, gemId) {
  const supabase = getSupabaseAdmin();

  const attempt1 = await supabase.from("gems").delete().eq("id", gemId).eq("user_id", userId);
  if (!attempt1.error) return { ok: true };

  const attempt2 = await supabase.from("gems").delete().eq("id", gemId);
  if (attempt2.error) throw new Error(`deleteGem failed: ${attempt2.error.message}`);

  return { ok: true };
}
