// /lib/features/novelcrafter/storyPersistence.server.ts
// Encrypted persistence for Novelcrafter Story State inside the messages table (Option A)

import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { encryptText, decryptText } from "@/lib/core/encryption";
import { invalidateConversationsCache } from "@/lib/core/cache";
import { getConversation, type Conversation } from "@/lib/features/chat/conversations";
import { MODEL_IDS, UUID_REGEX } from "@/lib/utils/constants";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import {
  createDefaultStoryState,
  MAX_HISTORY_CARDS,
  STALE_STORY_STATE_MESSAGE,
  type NovelcrafterStoryState,
} from "./types";
import { sanitizeStoryState } from "./promptBuilder";

const persistenceLogger = logger.withContext("novelcrafterPersistence");

interface StoryStateMessageRow {
  id: string;
  content: string | null;
  meta: Record<string, unknown> | null;
  created_at?: string | null;
}

/**
 * Verify that the conversation exists, belongs to the authenticated user,
 * and is a Novelcrafter Studio conversation (`model === MODEL_IDS.NOVELCRAFTER`).
 */
export async function verifyNovelcrafterConversationOwnership(
  userId: string,
  conversationId: string
): Promise<Conversation> {
  const trimmedId = String(conversationId || "").trim();
  if (!UUID_REGEX.test(trimmedId)) {
    throw new ValidationError("Invalid conversationId");
  }

  const convo = await getConversation(trimmedId);
  if (!convo || convo.userId !== userId || convo.model !== MODEL_IDS.NOVELCRAFTER) {
    throw new NotFoundError("Story");
  }

  return convo;
}

function decodeStoredState(
  encryptedContent: string | null | undefined,
  defaultChapterTitle?: string
): NovelcrafterStoryState | null {
  if (!encryptedContent) return null;
  const decrypted = decryptText(encryptedContent);
  if (!decrypted) return null;
  const parsed: unknown = JSON.parse(decrypted);
  return sanitizeStoryState(parsed, defaultChapterTitle);
}

/**
 * Retrieve and decrypt the NovelcrafterStoryState for a story conversation.
 * Returns a fresh default state if no state row exists yet.
 */
export async function getStoryState(
  userId: string,
  conversationId: string,
  defaultChapterTitle = "Chapter 1"
): Promise<NovelcrafterStoryState> {
  await verifyNovelcrafterConversationOwnership(userId, conversationId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, meta, created_at")
    .eq("conversation_id", conversationId)
    .eq("meta->>novelcrafterType", "story_state")
    .order("created_at", { ascending: false });

  if (error) {
    persistenceLogger.error("Failed to fetch story_state messages:", error);
    throw new DatabaseError(`Failed to load story state: ${error.message}`);
  }

  const rows = (data || []) as StoryStateMessageRow[];
  if (rows.length === 0) {
    return createDefaultStoryState(defaultChapterTitle);
  }

  // Clean up duplicate rows if concurrent initial inserts ever occurred
  if (rows.length > 1) {
    const duplicateIds = rows.slice(1).map((r) => r.id);
    const { error: deleteErr } = await supabase.from("messages").delete().in("id", duplicateIds);
    if (deleteErr) {
      persistenceLogger.warn("Failed to delete duplicate story_state rows:", deleteErr);
    }
  }

  try {
    const decoded = decodeStoredState(rows[0].content, defaultChapterTitle);
    return decoded ?? createDefaultStoryState(defaultChapterTitle);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown decryption error";
    persistenceLogger.error("Failed to decrypt or parse story state:", msg);
    throw new DatabaseError("Failed to decode encrypted story state");
  }
}

/**
 * Encrypt and persist the NovelcrafterStoryState into the messages table.
 * Enforces monotonic updatedAt/version check to reject stale out-of-order network writes,
 * deduplicates extra state rows, and updates the parent conversation's updated_at timestamp.
 */
export async function saveStoryState(
  userId: string,
  conversationId: string,
  state: NovelcrafterStoryState
): Promise<NovelcrafterStoryState> {
  await verifyNovelcrafterConversationOwnership(userId, conversationId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, meta, created_at")
    .eq("conversation_id", conversationId)
    .eq("meta->>novelcrafterType", "story_state")
    .order("created_at", { ascending: false });

  if (error) {
    persistenceLogger.error("Failed to read existing story_state before save:", error);
    throw new DatabaseError(`Failed to read story state: ${error.message}`);
  }

  const rows = (data || []) as StoryStateMessageRow[];
  let existingState: NovelcrafterStoryState | null = null;

  if (rows.length > 0 && rows[0].content) {
    try {
      existingState = decodeStoredState(rows[0].content);
    } catch {
      existingState = null;
    }
  }

  const metaVersion =
    rows.length > 0 && typeof rows[0]?.meta?.version === "number"
      ? Number(rows[0].meta.version)
      : 0;
  const metaUpdatedAt =
    rows.length > 0 && typeof rows[0]?.meta?.updatedAt === "number"
      ? Number(rows[0].meta.updatedAt)
      : 0;
  const effectiveExistingVersion = Math.max(existingState?.version ?? 0, metaVersion);
  const effectiveExistingUpdatedAt = Math.max(existingState?.updatedAt ?? 0, metaUpdatedAt);

  if (
    (existingState || metaVersion > 0) &&
    (state.updatedAt < effectiveExistingUpdatedAt || state.version < effectiveExistingVersion)
  ) {
    throw new ValidationError(STALE_STORY_STATE_MESSAGE);
  }

  const sanitized = sanitizeStoryState(state);
  const nextVersion =
    existingState || metaVersion > 0
      ? Math.max(sanitized.version, effectiveExistingVersion) + 1
      : 1;
  const nextUpdatedAt = Math.max(sanitized.updatedAt, effectiveExistingUpdatedAt, Date.now());

  const nextState: NovelcrafterStoryState = {
    ...sanitized,
    version: nextVersion,
    updatedAt: nextUpdatedAt,
    historyCards: sanitized.historyCards.slice(0, MAX_HISTORY_CARDS),
  };

  const encryptedContent = encryptText(JSON.stringify(nextState));
  const metaPayload = {
    novelcrafterType: "story_state",
    isContextOnly: true,
    version: nextVersion,
    updatedAt: nextUpdatedAt,
  };

  if (rows.length > 0) {
    const primaryId = rows[0].id;
    const { error: updateErr } = await supabase
      .from("messages")
      .update({
        role: "system",
        content: encryptedContent,
        meta: metaPayload,
      })
      .eq("id", primaryId);

    if (updateErr) {
      persistenceLogger.error("Failed to update story_state message:", updateErr);
      throw new DatabaseError(`Failed to update story state: ${updateErr.message}`);
    }

    if (rows.length > 1) {
      const duplicateIds = rows.slice(1).map((r) => r.id);
      const { error: deleteErr } = await supabase.from("messages").delete().in("id", duplicateIds);
      if (deleteErr) {
        persistenceLogger.warn("Failed to remove duplicate story_state rows:", deleteErr);
      }
    }
  } else {
    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "system",
      content: encryptedContent,
      meta: metaPayload,
    });

    if (insertErr) {
      persistenceLogger.error("Failed to insert story_state message:", insertErr);
      throw new DatabaseError(`Failed to save story state: ${insertErr.message}`);
    }
  }

  const isoNow = new Date(nextUpdatedAt).toISOString();
  const { error: convoUpdateErr } = await supabase
    .from("conversations")
    .update({ updated_at: isoNow })
    .eq("id", conversationId);

  if (convoUpdateErr) {
    persistenceLogger.warn("Failed to touch conversation updated_at:", convoUpdateErr);
  }

  await invalidateConversationsCache(userId);

  return nextState;
}
