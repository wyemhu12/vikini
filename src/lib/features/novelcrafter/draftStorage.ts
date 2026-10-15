// /lib/features/novelcrafter/draftStorage.ts
// Version-based localStorage draft persistence, LRU eviction, multi-device conflict backup, and payload budget guard

import { MODEL_IDS } from "@/lib/utils/constants";
import { sanitizeStoryState } from "./promptBuilder";
import type { NovelcrafterSyncCoordinator } from "./storySyncCoordinator";
import {
  MAX_HISTORY_CARDS,
  type NovelcrafterHistoryCard,
  type NovelcrafterStoryState,
  type StoryBible,
} from "./types";

export const DRAFT_STORAGE_PREFIX = "vikini:novelcrafter:draft:" as const;
export const UNSAVED_DRAFT_STORAGE_KEY = "vikini:novelcrafter:draft:unsaved" as const;
export const DRAFT_LRU_INDEX_KEY = "vikini:novelcrafter:draft-lru" as const;
export const MAX_CACHED_STORY_DRAFTS = 5 as const;
export const LOCAL_DRAFT_THROTTLE_MS = 300 as const;
export const CONFLICT_BACKUP_ACTION_LABEL = "Local Draft Backup" as const;
export const MAX_CONFLICT_BACKUP_CARD_CHARS = 16_000 as const;
export const MAX_CONFLICT_BACKUP_CARDS = 3 as const;
export const DEFAULT_MAX_STATE_PAYLOAD_BYTES = 1_800_000 as const;

export interface NovelcrafterLocalDraftEnvelope {
  baseVersion: number;
  dirty: boolean;
  savedAt: number;
  state: NovelcrafterStoryState;
}

const STORY_BIBLE_TEXT_FIELDS: ReadonlyArray<
  keyof Pick<
    StoryBible,
    "braindump" | "genre" | "style" | "synopsis" | "characters" | "worldbuilding" | "outline"
  >
> = ["braindump", "genre", "style", "synopsis", "characters", "worldbuilding", "outline"];

function getSafeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getDraftStorageKey(storyId: string | null | undefined): string {
  const trimmed = typeof storyId === "string" ? storyId.trim() : "";
  return trimmed ? `${DRAFT_STORAGE_PREFIX}${trimmed}` : UNSAVED_DRAFT_STORAGE_KEY;
}

export function hasUnsavedDraftContent(state: NovelcrafterStoryState): boolean {
  for (const field of STORY_BIBLE_TEXT_FIELDS) {
    if (state.storyBible[field].trim().length > 0) {
      return true;
    }
  }
  return state.chapters.some(
    (ch) =>
      ch.content.trim().length > 0 ||
      ch.scenes.trim().length > 0 ||
      (ch.extraInstructions ?? "").trim().length > 0
  );
}

function updateDraftLruIndex(storage: Storage, storyId: string): void {
  try {
    const raw = storage.getItem(DRAFT_LRU_INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const currentList = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    const deduped = [storyId, ...currentList.filter((id) => id !== storyId)];
    const kept = deduped.slice(0, MAX_CACHED_STORY_DRAFTS);
    const evicted = deduped.slice(MAX_CACHED_STORY_DRAFTS);

    for (const oldStoryId of evicted) {
      storage.removeItem(getDraftStorageKey(oldStoryId));
    }
    storage.setItem(DRAFT_LRU_INDEX_KEY, JSON.stringify(kept));
  } catch {
    // Ignore storage index errors
  }
}

export function writeLocalStoryDraft(
  storyId: string | null | undefined,
  state: NovelcrafterStoryState,
  options: { baseVersion: number; dirty: boolean }
): boolean {
  const storage = getSafeStorage();
  if (!storage) return false;

  const trimmedId = typeof storyId === "string" ? storyId.trim() : "";
  const key = getDraftStorageKey(trimmedId || null);
  const envelope: NovelcrafterLocalDraftEnvelope = {
    baseVersion: Math.max(1, Math.trunc(options.baseVersion)),
    dirty: Boolean(options.dirty),
    savedAt: Date.now(),
    state,
  };

  try {
    storage.setItem(key, JSON.stringify(envelope));
    if (trimmedId) {
      updateDraftLruIndex(storage, trimmedId);
    }
    return true;
  } catch {
    return false;
  }
}

export function readLocalStoryDraft(
  storyId: string | null | undefined,
  defaultChapterTitle = "Chapter 1"
): NovelcrafterLocalDraftEnvelope | null {
  const storage = getSafeStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(getDraftStorageKey(storyId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (!record.state || typeof record.state !== "object") {
      return null;
    }
    const sanitizedState = sanitizeStoryState(record.state, defaultChapterTitle);
    const baseVersion =
      typeof record.baseVersion === "number" && Number.isFinite(record.baseVersion)
        ? Math.max(1, Math.trunc(record.baseVersion))
        : sanitizedState.version;
    const dirty = typeof record.dirty === "boolean" ? record.dirty : false;
    const savedAt =
      typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
        ? record.savedAt
        : sanitizedState.updatedAt;

    return {
      baseVersion,
      dirty,
      savedAt,
      state: sanitizedState,
    };
  } catch {
    return null;
  }
}

export function removeLocalStoryDraft(storyId: string | null | undefined): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const trimmedId = typeof storyId === "string" ? storyId.trim() : "";
    storage.removeItem(getDraftStorageKey(trimmedId || null));
    if (trimmedId) {
      const raw = storage.getItem(DRAFT_LRU_INDEX_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((id) => id !== trimmedId);
          storage.setItem(DRAFT_LRU_INDEX_KEY, JSON.stringify(filtered));
        }
      }
    }
  } catch {
    // Ignore storage removal errors
  }
}

export function markLocalDraftSynced(
  storyId: string,
  ackedServerVersion: number,
  ackedSnapshotUpdatedAt: number,
  ackedServerUpdatedAt: number
): NovelcrafterLocalDraftEnvelope | null {
  const current = readLocalStoryDraft(storyId);
  if (!current) return null;

  const hasNewerUnflushedEdits = current.state.updatedAt > ackedSnapshotUpdatedAt;
  const nextUpdatedAt = hasNewerUnflushedEdits
    ? Math.max(current.state.updatedAt, ackedServerUpdatedAt + 1)
    : ackedServerUpdatedAt;

  const nextState: NovelcrafterStoryState = {
    ...current.state,
    version: ackedServerVersion,
    updatedAt: nextUpdatedAt,
  };

  writeLocalStoryDraft(storyId, nextState, {
    baseVersion: ackedServerVersion,
    dirty: hasNewerUnflushedEdits,
  });

  return readLocalStoryDraft(storyId);
}

export function buildConflictBackupCard(
  localState: NovelcrafterStoryState,
  remoteState: NovelcrafterStoryState,
  nowMs = Date.now()
): NovelcrafterHistoryCard | null {
  const diffSections: string[] = [];

  for (const field of STORY_BIBLE_TEXT_FIELDS) {
    const localVal = localState.storyBible[field].trim();
    const remoteVal = remoteState.storyBible[field].trim();
    if (localVal && localVal !== remoteVal) {
      diffSections.push(`[Story Bible - ${field}]\n${localVal}`);
    }
  }

  const remoteChapterMap = new Map(remoteState.chapters.map((c) => [c.id, c]));
  for (const localCh of localState.chapters) {
    const remoteCh = remoteChapterMap.get(localCh.id);
    const localScenes = localCh.scenes.trim();
    const remoteScenes = remoteCh?.scenes.trim() ?? "";
    const localContent = localCh.content.trim();
    const remoteContent = remoteCh?.content.trim() ?? "";

    if (localScenes && localScenes !== remoteScenes) {
      diffSections.push(`[${localCh.title} - Scenes]\n${localScenes}`);
    }
    if (localContent && localContent !== remoteContent) {
      diffSections.push(`[${localCh.title} - Prose]\n${localContent}`);
    }
  }

  if (diffSections.length === 0) {
    return null;
  }

  const rawCombined = diffSections.join("\n\n---\n\n");
  const content = rawCombined.slice(0, MAX_CONFLICT_BACKUP_CARD_CHARS);

  return {
    id: `conflict-backup-${nowMs}`,
    feature: "write",
    actionLabel: CONFLICT_BACKUP_ACTION_LABEL,
    subLabel: CONFLICT_BACKUP_ACTION_LABEL,
    content,
    model: localState.selectedModel,
    createdAt: nowMs,
  };
}

export function enforceStatePayloadBudget(
  state: NovelcrafterStoryState,
  maxBytes: number = DEFAULT_MAX_STATE_PAYLOAD_BYTES
): { state: NovelcrafterStoryState; fits: boolean } {
  const encoder = new TextEncoder();
  const measure = (candidate: NovelcrafterStoryState) =>
    encoder.encode(JSON.stringify(candidate)).byteLength;

  if (measure(state) <= maxBytes) {
    return { state, fits: true };
  }

  let currentCards = [...state.historyCards];
  let candidate: NovelcrafterStoryState = { ...state, historyCards: currentCards };

  while (currentCards.length > 0 && measure(candidate) > maxBytes) {
    currentCards = currentCards.slice(0, currentCards.length - 1);
    candidate = { ...candidate, historyCards: currentCards };
  }

  return {
    state: candidate,
    fits: measure(candidate) <= maxBytes,
  };
}

export function reconcileStoryStateWithDraft(
  remoteState: NovelcrafterStoryState,
  localEnvelope: NovelcrafterLocalDraftEnvelope | null,
  nowMs = Date.now()
): {
  state: NovelcrafterStoryState;
  shouldSyncDraftToServer: boolean;
  conflictDetected: boolean;
} {
  if (!localEnvelope || !localEnvelope.dirty) {
    return {
      state: remoteState,
      shouldSyncDraftToServer: false,
      conflictDetected: false,
    };
  }

  if (localEnvelope.baseVersion >= remoteState.version) {
    const reconciledState: NovelcrafterStoryState = {
      ...localEnvelope.state,
      version: remoteState.version,
      updatedAt: Math.max(localEnvelope.state.updatedAt, remoteState.updatedAt + 1),
    };
    return {
      state: reconciledState,
      shouldSyncDraftToServer: true,
      conflictDetected: false,
    };
  }

  // Multi-device / multi-tab conflict: baseVersion < remoteState.version
  const backupCard = buildConflictBackupCard(localEnvelope.state, remoteState, nowMs);
  if (!backupCard) {
    return {
      state: remoteState,
      shouldSyncDraftToServer: false,
      conflictDetected: false,
    };
  }

  const existingBackups: NovelcrafterHistoryCard[] = [];
  const otherCards: NovelcrafterHistoryCard[] = [];

  for (const card of remoteState.historyCards) {
    const isBackup =
      card.actionLabel === CONFLICT_BACKUP_ACTION_LABEL ||
      card.subLabel === CONFLICT_BACKUP_ACTION_LABEL;
    if (isBackup) {
      if (existingBackups.length < MAX_CONFLICT_BACKUP_CARDS - 1) {
        existingBackups.push(card);
      }
    } else {
      otherCards.push(card);
    }
  }

  const mergedCards = [backupCard, ...existingBackups, ...otherCards].slice(0, MAX_HISTORY_CARDS);

  return {
    state: {
      ...remoteState,
      historyCards: mergedCards,
      updatedAt: Math.max(remoteState.updatedAt + 1, nowMs),
    },
    shouldSyncDraftToServer: true,
    conflictDetected: true,
  };
}

export function promoteUnsavedDraftToStory(
  newStoryId: string,
  unsavedState: NovelcrafterStoryState,
  coordinator: NovelcrafterSyncCoordinator,
  options?: { markSkipNextGet?: boolean }
): NovelcrafterStoryState {
  const promotedState: NovelcrafterStoryState = {
    ...unsavedState,
    version: Math.max(1, unsavedState.version),
    updatedAt: Math.max(unsavedState.updatedAt, Date.now()),
  };
  coordinator.seedServerMeta(newStoryId, {
    version: 1,
    updatedAt: Math.max(0, promotedState.updatedAt - 1),
  });
  if (options?.markSkipNextGet !== false) {
    coordinator.markSkipInitialGet(newStoryId);
  }
  writeLocalStoryDraft(newStoryId, promotedState, {
    baseVersion: 1,
    dirty: true,
  });
  removeLocalStoryDraft(null);
  return promotedState;
}

export function resolveValidNovelcrafterStoryId(
  selectedConversationId: string | null | undefined,
  stories: ReadonlyArray<{ id: string; model?: string }>,
  coordinator?: NovelcrafterSyncCoordinator
): string | null {
  const trimmed = typeof selectedConversationId === "string" ? selectedConversationId.trim() : "";
  if (!trimmed) return null;

  const isInStoriesList = stories.some(
    (s) => s.id === trimmed && (!s.model || s.model === MODEL_IDS.NOVELCRAFTER)
  );
  if (isInStoriesList) {
    return trimmed;
  }

  if (coordinator?.isCandidateNewStoryId(trimmed)) {
    return trimmed;
  }

  return null;
}

export function countChapterWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}
