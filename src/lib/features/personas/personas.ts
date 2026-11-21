// /lib/features/personas/personas.ts
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import type { PersonaTone } from "@/types/persona";
import { buildPersonaSystemPrompt } from "./prompt-builder";
import { NotFoundError, ForbiddenError, DatabaseError } from "@/lib/utils/errors";

// ------------------------------
// Types
// ------------------------------

export interface PersonaRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  tone: string;
  use_emojis: boolean;
  use_headers_lists: boolean;
  user_context: string;
  custom_instructions: string;
  icon: string;
  color: string;
  is_premade: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonaInput {
  name: string;
  description?: string;
  tone?: string;
  useEmojis?: boolean;
  useHeadersLists?: boolean;
  userContext?: string;
  customInstructions?: string;
  icon?: string;
  color?: string;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string;
  tone?: string;
  useEmojis?: boolean;
  useHeadersLists?: boolean;
  userContext?: string;
  customInstructions?: string;
  icon?: string;
  color?: string;
}

// Valid tones for runtime validation
const VALID_TONES: ReadonlySet<string> = new Set([
  "default",
  "professional",
  "friendly",
  "candid",
  "quirky",
  "efficient",
  "cynical",
  "lawyer",
]);

function isValidTone(tone: string): tone is PersonaTone {
  return VALID_TONES.has(tone);
}

// ------------------------------
// Exports
// ------------------------------

export async function getPersonasForUser(userId: string): Promise<PersonaRow[]> {
  const supabase = getSupabaseAdmin();

  const [premadeRes, ownRes] = await Promise.all([
    supabase.from("personas").select("*").eq("is_premade", true),
    supabase.from("personas").select("*").eq("user_id", userId),
  ]);

  if (premadeRes.error) {
    throw new DatabaseError(`getPersonasForUser failed: ${premadeRes.error.message}`);
  }
  if (ownRes.error) {
    throw new DatabaseError(`getPersonasForUser failed: ${ownRes.error.message}`);
  }

  const byId = new Map<string, PersonaRow>();
  for (const row of (premadeRes.data || []) as PersonaRow[]) {
    byId.set(row.id, row);
  }
  for (const row of (ownRes.data || []) as PersonaRow[]) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.is_premade !== b.is_premade) return a.is_premade ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function createPersona(
  userId: string,
  input: CreatePersonaInput
): Promise<PersonaRow> {
  const supabase = getSupabaseAdmin();

  const tone = input.tone && isValidTone(input.tone) ? input.tone : "default";

  const { data, error } = await supabase
    .from("personas")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description ?? "",
      tone,
      use_emojis: input.useEmojis ?? true,
      use_headers_lists: input.useHeadersLists ?? true,
      user_context: input.userContext ?? "",
      custom_instructions: input.customInstructions ?? "",
      icon: input.icon ?? "",
      color: input.color ?? "",
    })
    .select("*")
    .single();

  if (error) throw new DatabaseError(`createPersona failed: ${error.message}`);
  return data as PersonaRow;
}

export async function updatePersona(
  userId: string,
  id: string,
  input: UpdatePersonaInput
): Promise<PersonaRow> {
  const supabase = getSupabaseAdmin();

  // Enforce ownership
  const { data: existing, error: existingErr } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingErr) throw new DatabaseError(`updatePersona read failed: ${existingErr.message}`);
  if (!existing) throw new NotFoundError("Persona");

  const existingRow = existing as PersonaRow;
  if (existingRow.is_premade) throw new ForbiddenError("Cannot modify premade persona");
  if (existingRow.user_id !== userId) throw new ForbiddenError();

  // Build patch object with only provided fields
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.tone !== undefined) {
    patch.tone = isValidTone(input.tone) ? input.tone : "default";
  }
  if (input.useEmojis !== undefined) patch.use_emojis = input.useEmojis;
  if (input.useHeadersLists !== undefined) patch.use_headers_lists = input.useHeadersLists;
  if (input.userContext !== undefined) patch.user_context = input.userContext;
  if (input.customInstructions !== undefined) patch.custom_instructions = input.customInstructions;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;

  const { data, error } = await supabase
    .from("personas")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new DatabaseError(`updatePersona failed: ${error.message}`);
  return data as PersonaRow;
}

export async function deletePersona(userId: string, id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Enforce ownership
  const { data: existing, error: existingErr } = await supabase
    .from("personas")
    .select("id, user_id, is_premade")
    .eq("id", id)
    .maybeSingle();

  if (existingErr) throw new DatabaseError(`deletePersona read failed: ${existingErr.message}`);
  if (!existing) return; // Already deleted, idempotent

  const existingRow = existing as { id: string; user_id: string; is_premade?: boolean };
  if (existingRow.is_premade) throw new ForbiddenError("Cannot delete premade persona");
  if (existingRow.user_id !== userId) throw new ForbiddenError();

  const { error } = await supabase.from("personas").delete().eq("id", id).eq("user_id", userId);

  if (error) throw new DatabaseError(`deletePersona failed: ${error.message}`);
}

export async function getPersonaInstructionsForConversation(
  userId: string,
  conversationId: string,
  preloadedPersonaId?: string | null
): Promise<string> {
  const supabase = getSupabaseAdmin();

  if (!conversationId) return "";

  let personaId: string | null | undefined = preloadedPersonaId;
  if (personaId === undefined) {
    // Look up persona_id on the conversation
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .select("persona_id,user_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (convoErr) {
      throw new DatabaseError(
        `getPersonaInstructionsForConversation convo failed: ${convoErr.message}`
      );
    }
    if (!convo) return "";

    const convoRow = convo as { user_id?: string; persona_id?: string };

    // Enforce ownership (defense-in-depth; chat route already authenticates)
    if (typeof convoRow.user_id === "string" && convoRow.user_id !== userId) {
      throw new ForbiddenError();
    }

    personaId = convoRow.persona_id;
  }

  if (!personaId) return "";

  // Fetch the persona
  const { data: persona, error: personaErr } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .maybeSingle();

  if (personaErr) {
    throw new DatabaseError(
      `getPersonaInstructionsForConversation persona failed: ${personaErr.message}`
    );
  }
  if (!persona) return "";

  const personaRow = persona as PersonaRow;
  if (!personaRow.is_premade && personaRow.user_id !== userId) {
    throw new ForbiddenError("You do not have permission to access this persona");
  }

  // Build system prompt from persona settings
  const tone = isValidTone(personaRow.tone) ? personaRow.tone : "default";

  return buildPersonaSystemPrompt({
    tone,
    useEmojis: personaRow.use_emojis ?? true,
    useHeadersLists: personaRow.use_headers_lists ?? true,
    userContext: personaRow.user_context ?? "",
    customInstructions: personaRow.custom_instructions ?? "",
  });
}
