// /lib/features/chat/conversations.js
import { getSupabaseAdmin } from "@/lib/core/supabase";
import { deleteAttachmentsByConversation } from "@/lib/features/attachments/attachments";

// ------------------------------
// Constants
// ------------------------------
export const DEFAULT_MODEL = "gemini-2.5-flash";

export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast & balanced" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Advanced thinking" },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", description: "Smart & fast" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", description: "Most intelligent" },
];

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
    // NEW: model field for per-chat model selection
    model: row.model ?? DEFAULT_MODEL,
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
  const model = typeof payload?.model === "string" ? payload.model : DEFAULT_MODEL;
  const now = new Date().toISOString();

  const attempt1 = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      model,
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
      model,
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

// NEW: Set model for a conversation
export async function setConversationModel(userId, conversationId, model) {
  const supabase = getSupabaseAdmin();

  const current = await getConversationSafe(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  // Validate model is in allowed list
  const validModel = AVAILABLE_MODELS.find((m) => m.id === model);
  const finalModel = validModel ? model : DEFAULT_MODEL;

  const { error } = await supabase
    .from("conversations")
    .update({ model: finalModel, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw new Error(`setConversationModel failed: ${error.message}`);
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
