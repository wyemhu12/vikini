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
    auth: { persistSession: false },
  });
}

function mapConversationRow(r) {
  if (!r) return null;

  const gem = r.gems || r.gem || null;

  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastMessagePreview: r.last_message_preview || "",
    gemId: r.gem_id || null,
    gem: gem
      ? {
          name: gem.name ?? null,
          icon: gem.icon ?? null,
          color: gem.color ?? null,
        }
      : null,
  };
}

function mapMessageRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  };
}

// ------------------------------
// CONVERSATIONS
// ------------------------------
export async function getUserConversations(userId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    // include gem basic metadata if FK exists
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id,gems(name,icon,color)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`getUserConversations failed: ${error.message}`);
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

export async function saveConversation(userId, { title = "New Chat" } = {}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      last_message_preview: "",
    })
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id")
    .single();

  if (error) throw new Error(`saveConversation failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function updateConversationTitle(userId, id, title) {
  const supabase = getSupabaseAdmin();

  // enforce ownership
  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { data, error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id")
    .single();

  if (error) throw new Error(`updateConversationTitle failed: ${error.message}`);
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
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id")
    .single();

  if (error) throw new Error(`setConversationAutoTitle failed: ${error.message}`);
  return mapConversationRow(data);
}

export async function deleteConversation(userId, id) {
  const supabase = getSupabaseAdmin();

  const current = await getConversation(id);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw new Error(`deleteConversation failed: ${error.message}`);

  return { ok: true };
}

/**
 * Set / unset gem for conversation WITHOUT touching title.
 * - gemId: uuid or null
 */
export async function setConversationGem(userId, conversationId, gemId) {
  const supabase = getSupabaseAdmin();

  const current = await getConversation(conversationId);
  if (!current) throw new Error("Conversation not found");
  if (current.userId !== userId) throw new Error("Forbidden");

  if (gemId) {
    // validate gem access
    const gem = await getGemForUser(userId, gemId);
    if (!gem) throw new Error("Gem not found");
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({
      gem_id: gemId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .select("id,user_id,title,created_at,updated_at,last_message_preview,gem_id")
    .single();

  if (error) throw new Error(`setConversationGem failed: ${error.message}`);
  return mapConversationRow(data);
}

// ------------------------------
// MESSAGES
// ------------------------------
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
  if (insertErr) throw new Error(`saveMessage failed: ${insertErr.message}`);

  const { error: updErr } = await supabase
    .from("conversations")
    .update({
      last_message_preview: preview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (updErr) throw new Error(`saveMessage update conv failed: ${updErr.message}`);

  return { ok: true };
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

// ------------------------------
// GEMS (full-feature: premade + my gems + versioning)
// ------------------------------
function mapGemRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id || null,
    isPremade: !!r.is_premade,
    slug: r.slug || null,
    name: r.name,
    description: r.description || "",
    icon: r.icon || "",
    color: r.color || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at || null,
  };
}

async function getLatestVersionsForGemIds(gemIds) {
  const supabase = getSupabaseAdmin();
  if (!gemIds?.length) return new Map();

  const { data, error } = await supabase
    .from("gem_versions")
    .select("gem_id,version,instructions,created_at,created_by")
    .in("gem_id", gemIds)
    .order("gem_id", { ascending: true })
    .order("version", { ascending: false });

  if (error) throw new Error(`getLatestVersions failed: ${error.message}`);

  const latest = new Map();
  for (const row of data || []) {
    if (!latest.has(row.gem_id)) {
      latest.set(row.gem_id, {
        version: row.version,
        instructions: row.instructions,
        createdAt: row.created_at,
        createdBy: row.created_by || null,
      });
    }
  }
  return latest;
}

export async function getGemsForUser(userId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("gems")
    .select("*")
    .is("deleted_at", null)
    .or(`is_premade.eq.true,user_id.eq.${userId}`)
    .order("is_premade", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`getGemsForUser failed: ${error.message}`);

  const gems = (data || []).map(mapGemRow);
  const ids = gems.map((g) => g.id);
  const latest = await getLatestVersionsForGemIds(ids);

  return gems.map((g) => {
    const v = latest.get(g.id);
    return {
      ...g,
      latestVersion: v?.version ?? null,
      instructions: v?.instructions ?? "",
    };
  });
}

export async function getGemForUser(userId, gemId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("gems")
    .select("*")
    .eq("id", gemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getGemForUser failed: ${error.message}`);
  const gem = mapGemRow(data);

  if (!gem) return null;
  if (gem.isPremade) return gem;
  if (gem.userId !== userId) return null;
  return gem;
}

export async function getGemInstructionsForUser(userId, gemId) {
  if (!gemId) return null;

  const gem = await getGemForUser(userId, gemId);
  if (!gem) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gem_versions")
    .select("version,instructions")
    .eq("gem_id", gemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getGemInstructions failed: ${error.message}`);
  return data?.instructions || null;
}

export async function createGem(userId, { name, description, instructions, icon, color }) {
  const supabase = getSupabaseAdmin();

  const { data: gemRow, error: gemErr } = await supabase
    .from("gems")
    .insert({
      user_id: userId,
      is_premade: false,
      name: String(name || "").trim(),
      description: description || "",
      icon: icon || "",
      color: color || "",
    })
    .select("*")
    .single();

  if (gemErr) throw new Error(`createGem failed: ${gemErr.message}`);

  const gem = mapGemRow(gemRow);

  const { error: verErr } = await supabase.from("gem_versions").insert({
    gem_id: gem.id,
    version: 1,
    instructions: String(instructions || ""),
    created_by: userId,
  });

  if (verErr) throw new Error(`createGem version failed: ${verErr.message}`);

  return { ...gem, latestVersion: 1, instructions: String(instructions || "") };
}

export async function updateGem(userId, gemId, { name, description, instructions, icon, color }) {
  const supabase = getSupabaseAdmin();

  const gem = await getGemForUser(userId, gemId);
  if (!gem) throw new Error("Gem not found");
  if (gem.isPremade) throw new Error("Premade gem is read-only");

  // Update metadata (do not force instructions)
  const updatePayload = {};
  if (name !== undefined) updatePayload.name = String(name || "").trim();
  if (description !== undefined) updatePayload.description = description || "";
  if (icon !== undefined) updatePayload.icon = icon || "";
  if (color !== undefined) updatePayload.color = color || "";

  if (Object.keys(updatePayload).length) {
    const { error } = await supabase.from("gems").update(updatePayload).eq("id", gemId);
    if (error) throw new Error(`updateGem meta failed: ${error.message}`);
  }

  // If instructions provided -> create new version (full-feature)
  let newVersion = null;
  let finalInstructions = null;

  if (instructions !== undefined) {
    const { data: last, error: lastErr } = await supabase
      .from("gem_versions")
      .select("version")
      .eq("gem_id", gemId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw new Error(`updateGem read last version failed: ${lastErr.message}`);

    const nextVersion = (last?.version || 0) + 1;

    const { error: verErr } = await supabase.from("gem_versions").insert({
      gem_id: gemId,
      version: nextVersion,
      instructions: String(instructions || ""),
      created_by: userId,
    });

    if (verErr) throw new Error(`updateGem create version failed: ${verErr.message}`);

    newVersion = nextVersion;
    finalInstructions = String(instructions || "");
  }

  // Return updated gem + latest instructions
  const { data: g2, error: g2Err } = await supabase
    .from("gems")
    .select("*")
    .eq("id", gemId)
    .maybeSingle();

  if (g2Err) throw new Error(`updateGem reload failed: ${g2Err.message}`);

  const latest = finalInstructions
    ? { version: newVersion, instructions: finalInstructions }
    : await (async () => {
        const { data: v, error: vErr } = await supabase
          .from("gem_versions")
          .select("version,instructions")
          .eq("gem_id", gemId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (vErr) throw new Error(`updateGem reload version failed: ${vErr.message}`);
        return v ? { version: v.version, instructions: v.instructions } : { version: null, instructions: "" };
      })();

  return { ...mapGemRow(g2), latestVersion: latest.version, instructions: latest.instructions };
}

export async function deleteGem(userId, gemId) {
  const supabase = getSupabaseAdmin();

  const gem = await getGemForUser(userId, gemId);
  if (!gem) throw new Error("Gem not found");
  if (gem.isPremade) throw new Error("Premade gem is read-only");

  const { error } = await supabase
    .from("gems")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", gemId);

  if (error) throw new Error(`deleteGem failed: ${error.message}`);
  return { ok: true };
}
