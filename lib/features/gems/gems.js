// /lib/features/gems/gems.js
import { getSupabaseAdmin } from "@/lib/core/supabase";

// ------------------------------
// Helpers
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

// ------------------------------
// Exports
// ------------------------------

export async function listGems() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("gems").select("*").order("name", { ascending: true });
  if (error) throw new Error(`listGems failed: ${error.message}`);
  return data || [];
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
