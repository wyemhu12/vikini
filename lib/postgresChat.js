// /lib/postgresChat.js
import { createClient } from "@supabase/supabase-js";
import { deleteAttachmentsByConversation } from "./attachments";

function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function getSupabaseAdmin() {
  // Accept common Supabase env aliases to avoid Vercel misconfig
  const url = pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const serviceKey = pickFirstEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE",
  ]);

  if (!url) throw new Error("Missing Supabase URL env (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)");
  if (!serviceKey) throw new Error("Missing Supabase service role key env (SUPABASE_SERVICE_ROLE_KEY)");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ------------------------------
// Row mappers
// ------------------------------
function mapConversationRow(row) {
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

async function getConversationSafe(conversationId) {
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
// Gems
// ------------------------------
function normalizeGemPayload(payload) {
  const body = payload && typeof payload === "object" ? payload : {};

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

function sanitizeOrFilterValue(value) {
  // PostgREST filter strings treat commas as separators, so strip them defensively.
  return String(value ?? "").replace(/,/g, "").trim();
}

async function tryGetLatestGemVersion(supabase, gemId) {
  // Returns { version, instructions } or null. Safe to call even if table doesn't exist.
  const q = await supabase
    .from("gem_versions")
    .select("version,instructions")
    .eq("gem_id", gemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (q.error) return null;

  return {
    version: typeof q.data?.version === "number" ? q.data.version : 0,
    instructions: typeof q.data?.instructions === "string" ? q.data.instructions : "",
  };
}

async function tryInsertGemVersion(supabase, { gemId, instructions, createdBy }) {
  if (typeof instructions !== "string") return null;

  // Determine next version (max + 1)
  const prev = await supabase
    .from("gem_versions")
    .select("version")
    .eq("gem_id", gemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prev.error) return null;

  const nextVersion = (typeof prev.data?.version === "number" ? prev.data.version : 0) + 1;

  // Prefer schema: gem_id, version, instructions, created_by
  const ins1 = await supabase
    .from("gem_versions")
    .insert({
      gem_id: gemId,
      version: nextVersion,
      instructions,
      created_by: createdBy,
    })
    .select("gem_id,version,instructions")
    .single();

  if (!ins1.error) return ins1.data;

  // Fallback: no created_by column
  const ins2 = await supabase
    .from("gem_versions")
    .insert({
      gem_id: gemId,
      version: nextVersion,
      instructions,
    })
    .select("gem_id,version,instructions")
    .single();

  if (ins2.error) return null;
  return ins2.data;
}

export async function getGemInstructionsForConversation(userId, conversationId) {
  const supabase = getSupabaseAdmin();

  if (!conversationId) return "";

  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("gem_id,user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convoErr) throw new Error(`getGemInstructionsForConversation convo failed: ${convoErr.message}`);
  if (!convo) return "";

  // If user_id exists on the row, enforce ownership (defense-in-depth; chat route already authenticates).
  if (typeof convo.user_id === "string" && convo.user_id !== userId) {
    throw new Error("Forbidden");
  }

  const gemId = convo?.gem_id;
  if (!gemId) return "";

  // Prefer gem_versions latest instructions if available
  const latest = await tryGetLatestGemVersion(supabase, gemId);
  if (latest && typeof latest.instructions === "string") return latest.instructions;

  // Fallback to legacy columns on gems
  const { data: gem, error: gemErr } = await supabase
    .from("gems")
    .select("instruction,instructions")
    .eq("id", gemId)
    .maybeSingle();

  if (gemErr) throw new Error(`getGemInstructionsForConversation gem failed: ${gemErr.message}`);

  const ins =
    (typeof gem?.instructions === "string" && gem.instructions) ||
    (typeof gem?.instruction === "string" && gem.instruction) ||
    "";

  return ins;
}

export async function getGemInstructionsForUser(userId) {
  // Legacy helper (kept for compatibility). Prefer getGemInstructionsForConversation instead.
  const supabase = getSupabaseAdmin();

  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convoErr) throw new Error(`getGemInstructionsForUser convo failed: ${convoErr.message}`);

  return getGemInstructionsForConversation(userId, convo?.id);
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

export async function getGemsForUser(userId) {
  const supabase = getSupabaseAdmin();

  const safeUserId = sanitizeOrFilterValue(userId);

  // Desired semantics: premade (is_premade=true) + user-owned
  let gems = null;

  let q = await supabase
    .from("gems")
    .select("*")
    .or(`is_premade.eq.true,user_id.eq.${safeUserId}`)
    .order("name", { ascending: true });

  if (q.error) {
    // Fallback if the owner column is camelCase (userId)
    q = await supabase
      .from("gems")
      .select("*")
      .or(`is_premade.eq.true,userId.eq.${safeUserId}`)
      .order("name", { ascending: true });
  }

  if (!q.error) {
    gems = q.data || [];
  } else {
    // Legacy fallback (read-only): keep previous behavior rather than failing hard.
    const q1 = await supabase.from("gems").select("*").eq("user_id", userId).order("name", { ascending: true });
    if (!q1.error) gems = q1.data || [];
    else {
      const q2 = await supabase.from("gems").select("*").order("name", { ascending: true });
      if (q2.error) throw new Error(`getGemsForUser failed: ${q2.error.message}`);
      gems = q2.data || [];
    }
  }

  // Enrich with latest gem_versions when available
  const ids = (gems || []).map((g) => g?.id).filter(Boolean);

  const fallbackEnriched = (gems || []).map((g) => ({
    ...g,
    latestVersion: 0,
    instructions:
      (typeof g?.instructions === "string" && g.instructions) ||
      (typeof g?.instruction === "string" && g.instruction) ||
      "",
  }));

  if (!ids.length) return fallbackEnriched;

  const vq = await supabase
    .from("gem_versions")
    .select("gem_id,version,instructions")
    .in("gem_id", ids)
    .order("version", { ascending: false });

  if (vq.error || !Array.isArray(vq.data)) return fallbackEnriched;

  const latestByGem = new Map();
  for (const row of vq.data) {
    const gemId = row?.gem_id;
    if (!gemId || latestByGem.has(gemId)) continue;
    latestByGem.set(gemId, {
      version: typeof row?.version === "number" ? row.version : 0,
      instructions: typeof row?.instructions === "string" ? row.instructions : "",
    });
  }

  return (gems || []).map((g) => {
    const latest = latestByGem.get(g.id);
    const fallback =
      (typeof g?.instructions === "string" && g.instructions) ||
      (typeof g?.instruction === "string" && g.instruction) ||
      "";
    return {
      ...g,
      latestVersion: latest ? latest.version : 0,
      instructions: latest ? latest.instructions : fallback,
    };
  });
}

export async function createGem(userId, payload) {
  const supabase = getSupabaseAdmin();
  const body = normalizeGemPayload(payload);

  // Insert gem (prefer owner column user_id; fall back to userId)
  let created = null;

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

  if (!attempt1.error) {
    created = attempt1.data;
  } else {
    const attempt2 = await supabase
      .from("gems")
      .insert({
        userId,
        name: body.name,
        description: body.description,
        instruction: body.instruction,
        icon: body.icon,
        color: body.color,
      })
      .select("*")
      .single();

    if (attempt2.error) throw new Error(`createGem failed: ${attempt2.error.message}`);
    created = attempt2.data;
  }

  // Create initial version when gem_versions exists (non-fatal if not)
  let latestVersion = 0;
  let instructions =
    (typeof created?.instructions === "string" && created.instructions) ||
    (typeof created?.instruction === "string" && created.instruction) ||
    "";

  if (created?.id) {
    const ins = await tryInsertGemVersion(supabase, {
      gemId: created.id,
      instructions: body.instruction,
      createdBy: userId,
    });

    if (ins) {
      latestVersion = typeof ins.version === "number" ? ins.version : 1;
      instructions = typeof ins.instructions === "string" ? ins.instructions : instructions;
    }
  }

  return { ...created, latestVersion, instructions };
}

export async function updateGem(userId, gemId, payload) {
  const supabase = getSupabaseAdmin();
  const body = normalizeGemPayload(payload);

  // Enforce ownership + premade read-only (defense-in-depth)
  const { data: existing, error: existingErr } = await supabase
    .from("gems")
    .select("*")
    .eq("id", gemId)
    .maybeSingle();

  if (existingErr) throw new Error(`updateGem read failed: ${existingErr.message}`);
  if (!existing) throw new Error("Gem not found");

  const isPremade = existing?.is_premade === true || existing?.isPremade === true;
  if (isPremade) throw new Error("Premade gem is read-only");

  const owner =
    (typeof existing?.user_id === "string" && existing.user_id) ||
    (typeof existing?.userId === "string" && existing.userId) ||
    "";
  if (owner && owner !== userId) throw new Error("Forbidden");

  // Update metadata on gems table (instructions are versioned; still keep legacy columns updated as fallback)
  const patch = {
    name: body.name,
    description: body.description,
    icon: body.icon,
    color: body.color,
    instruction: body.instruction,
  };

  let updated = null;

  const attempt1 = await supabase
    .from("gems")
    .update(patch)
    .eq("id", gemId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (!attempt1.error) {
    updated = attempt1.data;
  } else {
    const attempt2 = await supabase
      .from("gems")
      .update(patch)
      .eq("id", gemId)
      .eq("userId", userId)
      .select("*")
      .single();

    if (attempt2.error) throw new Error(`updateGem failed: ${attempt2.error.message}`);
    updated = attempt2.data;
  }

  // Create a new gem_versions row when instructions are provided (non-fatal if gem_versions doesn't exist)
  let latestVersion = 0;
  let instructions =
    (typeof updated?.instructions === "string" && updated.instructions) ||
    (typeof updated?.instruction === "string" && updated.instruction) ||
    "";

  const instructionsProvided =
    typeof payload?.instructions === "string" ||
    typeof payload?.instruction === "string" ||
    typeof payload?.instructions === "string";

  if (instructionsProvided) {
    const ins = await tryInsertGemVersion(supabase, {
      gemId,
      instructions: body.instruction,
      createdBy: userId,
    });

    if (ins) {
      latestVersion = typeof ins.version === "number" ? ins.version : 0;
      instructions = typeof ins.instructions === "string" ? ins.instructions : instructions;
    }
  }

  // If version insert didn't happen, still try to read latest version for consistency
  if (!latestVersion) {
    const latest = await tryGetLatestGemVersion(supabase, gemId);
    if (latest) {
      latestVersion = typeof latest.version === "number" ? latest.version : 0;
      instructions = typeof latest.instructions === "string" ? latest.instructions : instructions;
    }
  }

  return { ...updated, latestVersion, instructions };
}

export async function deleteGem(userId, gemId) {
  const supabase = getSupabaseAdmin();

  // Enforce ownership + premade read-only (defense-in-depth)
  const { data: existing, error: existingErr } = await supabase
    .from("gems")
    .select("*")
    .eq("id", gemId)
    .maybeSingle();

  if (existingErr) throw new Error(`deleteGem read failed: ${existingErr.message}`);
  if (!existing) return { ok: true };

  const isPremade = existing?.is_premade === true || existing?.isPremade === true;
  if (isPremade) throw new Error("Premade gem is read-only");

  const owner =
    (typeof existing?.user_id === "string" && existing.user_id) ||
    (typeof existing?.userId === "string" && existing.userId) ||
    "";
  if (owner && owner !== userId) throw new Error("Forbidden");

  const attempt1 = await supabase.from("gems").delete().eq("id", gemId).eq("user_id", userId);
  if (!attempt1.error) return { ok: true };

  const attempt2 = await supabase.from("gems").delete().eq("id", gemId).eq("userId", userId);
  if (attempt2.error) throw new Error(`deleteGem failed: ${attempt2.error.message}`);

  return { ok: true };
}
