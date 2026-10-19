// /lib/features/novelcrafter/storyPersistence.server.ts
// Server-side encrypted persistence for Novelcrafter Story State inside messages table
// Uses AES-256-GCM directly without chat <think> stripping (S3)

import { invalidateConversationsCache } from "@/lib/core/cache";
import { decryptText, encryptText } from "@/lib/core/encryption";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { getConversation } from "@/lib/features/chat/conversations";
import { MODEL_IDS, UUID_REGEX } from "@/lib/utils/constants";
import { AppError, DatabaseError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { sanitizeStoryState } from "./promptBuilder";
import {
  createDefaultStoryState,
  STALE_STORY_STATE_MESSAGE,
  type NovelcrafterStoryState,
} from "./types";

const dbLogger = logger.withContext("novelcrafterPersistence");

export const NOVELCRAFTER_STATE_META_TYPE = "story_state" as const;
export const NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE = "story_state_corrupted_backup" as const;
export const DESTRUCTIVE_SAVE_MIN_CHARS = 2_000 as const;

interface RawStateMessageRow {
  id: string;
  content: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export function computeTotalStoryContentChars(state: NovelcrafterStoryState): number {
  const b = state.storyBible;
  let total =
    b.braindump.length +
    b.genre.length +
    b.style.length +
    b.synopsis.length +
    b.characters.length +
    b.worldbuilding.length +
    b.outline.length;

  for (const c of b.characterCards || []) {
    total +=
      c.name.length +
      c.role.length +
      c.traits.length +
      (c.aliases ? c.aliases.join(", ").length : 0);
  }
  for (const w of b.worldElements || []) {
    total +=
      w.name.length +
      w.category.length +
      w.description.length +
      (w.aliases ? w.aliases.join(", ").length : 0);
  }
  for (const o of b.outlineItems || []) {
    total += o.title.length + o.summary.length;
  }
  for (const ch of state.chapters) {
    total +=
      ch.title.length +
      ch.scenes.length +
      ch.content.length +
      (ch.summary?.length ?? 0) +
      (ch.extraInstructions?.length ?? 0);
  }
  return total;
}

/**
 * Verify that conversationId is a valid UUID, belongs to userId,
 * and is a dedicated Novelcrafter story conversation (model === "vikini-novelcrafter").
 */
export async function verifyNovelcrafterConversationOwnership(
  userId: string,
  conversationId: string
): Promise<void> {
  if (!conversationId || !UUID_REGEX.test(conversationId)) {
    throw new ValidationError("Invalid conversationId");
  }

  const convo = await getConversation(conversationId);
  if (!convo || convo.userId !== userId) {
    throw new NotFoundError("Story conversation");
  }

  if (convo.model !== MODEL_IDS.NOVELCRAFTER) {
    throw new NotFoundError("Story conversation");
  }
}

async function fetchStoryStateRows(conversationId: string): Promise<RawStateMessageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, meta, created_at")
    .eq("conversation_id", conversationId)
    .eq("meta->>novelcrafterType", NOVELCRAFTER_STATE_META_TYPE)
    .order("created_at", { ascending: false });

  if (error) {
    dbLogger.error("Failed to query story_state message:", error);
    throw new DatabaseError("Failed to load story state");
  }

  const rows = (data ?? []) as RawStateMessageRow[];

  if (rows.length > 1) {
    const duplicateIds = rows.slice(1).map((r) => r.id);
    const { error: delError } = await supabase.from("messages").delete().in("id", duplicateIds);
    if (delError) {
      dbLogger.warn("Failed to clean up duplicate story_state rows:", delError);
    }
  }

  return rows;
}

/**
 * Load and decrypt the NovelcrafterStoryState for a verified story conversation.
 */
export async function getStoryState(
  userId: string,
  conversationId: string
): Promise<NovelcrafterStoryState> {
  await verifyNovelcrafterConversationOwnership(userId, conversationId);

  const rows = await fetchStoryStateRows(conversationId);
  if (rows.length === 0 || !rows[0].content) {
    return createDefaultStoryState();
  }

  try {
    const decryptedJson = decryptText(rows[0].content);
    const parsed: unknown = JSON.parse(decryptedJson);
    return sanitizeStoryState(parsed);
  } catch (err: unknown) {
    dbLogger.error("Failed to decrypt or parse story_state payload:", err);
    throw new AppError("Story state is unreadable", 500, "STORY_STATE_CORRUPTED");
  }
}

/**
 * Encrypt and persist the NovelcrafterStoryState into a single system message row.
 * Rejects stale overwrites (NC-08) and guards against accidental >90% content wipes.
 */
export async function saveStoryState(
  userId: string,
  conversationId: string,
  incomingState: NovelcrafterStoryState,
  options?: { allowDestructive?: boolean }
): Promise<NovelcrafterStoryState> {
  await verifyNovelcrafterConversationOwnership(userId, conversationId);

  const sanitized = sanitizeStoryState(incomingState);
  const rows = await fetchStoryStateRows(conversationId);
  const existingRow = rows[0] ?? null;
  const existingMeta = existingRow?.meta ?? null;

  let existingVersion = 0;
  let existingCorrupted = false;
  let parsedExistingState: NovelcrafterStoryState | null = null;

  if (existingRow) {
    const rawMetaVersion = existingMeta?.version;
    const rawMetaUpdatedAt = existingMeta?.updatedAt;
    existingVersion = typeof rawMetaVersion === "number" ? rawMetaVersion : 0;
    const existingUpdatedAt = typeof rawMetaUpdatedAt === "number" ? rawMetaUpdatedAt : 0;

    if (existingRow.content) {
      try {
        const decryptedExisting = decryptText(existingRow.content);
        parsedExistingState = sanitizeStoryState(JSON.parse(decryptedExisting));
      } catch {
        existingCorrupted = true;
      }
    }

    if (
      !existingCorrupted &&
      (sanitized.version < existingVersion || sanitized.updatedAt < existingUpdatedAt)
    ) {
      throw new ValidationError(STALE_STORY_STATE_MESSAGE);
    }
  }

  const nextChars = computeTotalStoryContentChars(sanitized);

  if (existingRow && !options?.allowDestructive) {
    if (existingCorrupted) {
      const fallbackPreviousChars =
        typeof existingMeta?.contentChars === "number" && existingMeta.contentChars > 0
          ? existingMeta.contentChars
          : DESTRUCTIVE_SAVE_MIN_CHARS;
      const corruptedErr = new AppError(
        "Destructive save rejected: existing remote story state is corrupted and requires explicit confirmation before overwrite",
        409,
        "DESTRUCTIVE_SAVE_REJECTED"
      ) as AppError & {
        previousChars: number;
        nextChars: number;
        reason: "corrupted_remote";
      };
      corruptedErr.previousChars = fallbackPreviousChars;
      corruptedErr.nextChars = nextChars;
      corruptedErr.reason = "corrupted_remote";
      throw corruptedErr;
    }

    let previousChars =
      typeof existingMeta?.contentChars === "number" ? existingMeta.contentChars : -1;
    if (previousChars < 0 && parsedExistingState) {
      previousChars = computeTotalStoryContentChars(parsedExistingState);
    } else if (previousChars < 0) {
      previousChars = 0;
    }

    if (previousChars >= DESTRUCTIVE_SAVE_MIN_CHARS && nextChars < previousChars * 0.1) {
      const destructiveErr = new AppError(
        "Destructive save rejected: content dropped by more than 90%",
        409,
        "DESTRUCTIVE_SAVE_REJECTED"
      ) as AppError & {
        previousChars: number;
        nextChars: number;
        reason?: "content_drop";
      };
      destructiveErr.previousChars = previousChars;
      destructiveErr.nextChars = nextChars;
      destructiveErr.reason = "content_drop";
      throw destructiveErr;
    }
  }

  const now = Date.now();
  const nextVersion = existingRow ? Math.max(sanitized.version, existingVersion) + 1 : 1;
  const stateToSave: NovelcrafterStoryState = {
    ...sanitized,
    version: nextVersion,
    updatedAt: Math.max(sanitized.updatedAt, now),
  };

  const encryptedContent = encryptText(JSON.stringify(stateToSave));
  const metaPayload = {
    novelcrafterType: NOVELCRAFTER_STATE_META_TYPE,
    isContextOnly: true,
    version: stateToSave.version,
    updatedAt: stateToSave.updatedAt,
    contentChars: nextChars,
  };

  const supabase = getSupabaseAdmin();

  if (existingRow) {
    if (existingCorrupted && options?.allowDestructive && existingRow.content) {
      const { error: backupError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "system",
        content: existingRow.content,
        meta: {
          novelcrafterType: NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE,
          isContextOnly: true,
          corruptedAt: now,
          sourceRowId: existingRow.id,
          corruptedVersion: existingVersion,
          previousMeta: existingMeta,
        },
      });

      if (backupError) {
        dbLogger.error("Failed to back up corrupted story_state row:", backupError);
        throw new DatabaseError("Failed to preserve corrupted story state backup");
      }
    }

    const baseUpdate = supabase
      .from("messages")
      .update({
        role: "system",
        content: encryptedContent,
        meta: metaPayload,
      })
      .eq("id", existingRow.id) as unknown as {
      eq?: (
        col: string,
        val: string
      ) => {
        select?: (
          cols: string
        ) => Promise<{ data: Array<{ id: string }> | null; error: { message?: string } | null }>;
      } & Promise<{ data: Array<{ id: string }> | null; error: { message?: string } | null }>;
    } & Promise<{ data: Array<{ id: string }> | null; error: { message?: string } | null }>;

    let updateRes: { data: Array<{ id: string }> | null; error: { message?: string } | null };
    if (typeof baseUpdate.eq === "function" && existingMeta?.version !== undefined) {
      const withVersion = baseUpdate.eq("meta->>version", String(existingVersion));
      updateRes =
        typeof withVersion.select === "function"
          ? await withVersion.select("id")
          : await withVersion;
      if (!updateRes.error && Array.isArray(updateRes.data) && updateRes.data.length === 0) {
        throw new AppError(STALE_STORY_STATE_MESSAGE, 409, "STALE_STORY_STATE");
      }
    } else {
      updateRes = await baseUpdate;
    }

    if (updateRes.error) {
      dbLogger.error("Failed to update story_state message:", updateRes.error);
      throw new DatabaseError("Failed to save story state");
    }
  } else {
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "system",
      content: encryptedContent,
      meta: metaPayload,
    });

    if (insertError) {
      dbLogger.error("Failed to insert story_state message:", insertError);
      throw new DatabaseError("Failed to save story state");
    }
  }

  const { error: convoUpdateError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date(stateToSave.updatedAt).toISOString() })
    .eq("id", conversationId);

  if (convoUpdateError) {
    dbLogger.warn("Failed to touch conversation updated_at:", convoUpdateError);
  }

  await invalidateConversationsCache(userId);
  return stateToSave;
}
