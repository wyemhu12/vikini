// /lib/features/novelcrafter/draftStorage.ts
// Version-based localStorage draft persistence, LRU eviction, multi-device conflict backup, and payload budget guard

import { MODEL_IDS } from "@/lib/utils/constants";
import { sanitizeStoryState } from "./promptBuilder";
import type { NovelcrafterSyncCoordinator } from "./storySyncCoordinator";
import {
  createDefaultStoryState,
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
    if (state.storyBible[field].trim().length > 0) return true;
  }
  if (
    (state.storyBible.characterCards?.length ?? 0) > 0 ||
    (state.storyBible.worldElements?.length ?? 0) > 0 ||
    (state.storyBible.outlineItems?.length ?? 0) > 0
  ) {
    return true;
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
    for (const oldStoryId of deduped.slice(MAX_CACHED_STORY_DRAFTS)) {
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
  const envelope: NovelcrafterLocalDraftEnvelope = {
    baseVersion: Math.max(1, Math.trunc(options.baseVersion)),
    dirty: Boolean(options.dirty),
    savedAt: Date.now(),
    state,
  };
  try {
    storage.setItem(getDraftStorageKey(trimmedId || null), JSON.stringify(envelope));
    if (trimmedId) updateDraftLruIndex(storage, trimmedId);
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
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!record.state || typeof record.state !== "object") return null;
    const sanitizedState = sanitizeStoryState(record.state, defaultChapterTitle);
    const baseVersion =
      typeof record.baseVersion === "number" && Number.isFinite(record.baseVersion)
        ? Math.max(1, Math.trunc(record.baseVersion))
        : sanitizedState.version;
    return {
      baseVersion,
      dirty: typeof record.dirty === "boolean" ? record.dirty : false,
      savedAt:
        typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
          ? record.savedAt
          : sanitizedState.updatedAt,
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
          storage.setItem(
            DRAFT_LRU_INDEX_KEY,
            JSON.stringify(parsed.filter((id) => id !== trimmedId))
          );
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
  writeLocalStoryDraft(
    storyId,
    { ...current.state, version: ackedServerVersion, updatedAt: nextUpdatedAt },
    { baseVersion: ackedServerVersion, dirty: hasNewerUnflushedEdits }
  );
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
  const localCharCards = localState.storyBible.characterCards ?? [];
  const remoteCharCards = remoteState.storyBible.characterCards ?? [];
  if (
    localCharCards.length > 0 &&
    JSON.stringify(localCharCards) !== JSON.stringify(remoteCharCards)
  ) {
    diffSections.push(`[Story Bible - characterCards]\n${JSON.stringify(localCharCards)}`);
  }
  const localWorld = localState.storyBible.worldElements ?? [];
  const remoteWorld = remoteState.storyBible.worldElements ?? [];
  if (localWorld.length > 0 && JSON.stringify(localWorld) !== JSON.stringify(remoteWorld)) {
    diffSections.push(`[Story Bible - worldElements]\n${JSON.stringify(localWorld)}`);
  }
  const localOutline = localState.storyBible.outlineItems ?? [];
  const remoteOutline = remoteState.storyBible.outlineItems ?? [];
  if (localOutline.length > 0 && JSON.stringify(localOutline) !== JSON.stringify(remoteOutline)) {
    diffSections.push(`[Story Bible - outlineItems]\n${JSON.stringify(localOutline)}`);
  }
  const remoteChapterMap = new Map(remoteState.chapters.map((c) => [c.id, c]));
  for (const localCh of localState.chapters) {
    const remoteCh = remoteChapterMap.get(localCh.id);
    const localScenes = localCh.scenes.trim();
    const localContent = localCh.content.trim();
    const localExtra = (localCh.extraInstructions ?? "").trim();
    if (localScenes && localScenes !== (remoteCh?.scenes.trim() ?? "")) {
      diffSections.push(`[${localCh.title} - Scenes]\n${localScenes}`);
    }
    if (localContent && localContent !== (remoteCh?.content.trim() ?? "")) {
      diffSections.push(`[${localCh.title} - Prose]\n${localContent}`);
    }
    if (localExtra && localExtra !== (remoteCh?.extraInstructions ?? "").trim()) {
      diffSections.push(`[${localCh.title} - Extra Instructions]\n${localExtra}`);
    }
  }
  if (diffSections.length === 0) return null;
  return {
    id: `conflict-backup-${nowMs}`,
    feature: "write",
    actionLabel: CONFLICT_BACKUP_ACTION_LABEL,
    subLabel: CONFLICT_BACKUP_ACTION_LABEL,
    content: diffSections.join("\n\n---\n\n").slice(0, MAX_CONFLICT_BACKUP_CARD_CHARS),
    model: localState.selectedModel,
    createdAt: nowMs,
  };
}

export interface PayloadBudgetFitResult {
  state: NovelcrafterStoryState;
  fits: boolean;
  trimmedHistoryCount: number;
  trimmedFeedbackCount: number;
  largestFields?: string[];
}

export function enforceStatePayloadBudget(
  state: NovelcrafterStoryState,
  maxBytes: number = DEFAULT_MAX_STATE_PAYLOAD_BYTES
): PayloadBudgetFitResult {
  const encoder = new TextEncoder();
  const measure = (candidate: NovelcrafterStoryState) =>
    encoder.encode(JSON.stringify(candidate)).byteLength;

  if (measure(state) <= maxBytes) {
    return { state, fits: true, trimmedHistoryCount: 0, trimmedFeedbackCount: 0 };
  }

  // Tier 1: Trim historyCards from oldest to newest down to 0
  let currentCards = [...state.historyCards];
  let trimmedHistoryCount = 0;
  let candidate: NovelcrafterStoryState = { ...state, historyCards: currentCards };

  while (currentCards.length > 0 && measure(candidate) > maxBytes) {
    currentCards = currentCards.slice(0, currentCards.length - 1);
    trimmedHistoryCount += 1;
    candidate = { ...candidate, historyCards: currentCards };
  }

  if (measure(candidate) <= maxBytes) {
    return { state: candidate, fits: true, trimmedHistoryCount, trimmedFeedbackCount: 0 };
  }

  // Tier 2: Trim resolved feedbackItems across chapters (NEVER touch open feedback, chapter prose, or Story Bible)
  let trimmedFeedbackCount = 0;
  const trimmedChapters = candidate.chapters.map((ch) => {
    const openOnly = ch.feedbackItems.filter((item) => {
      if (item.status === "resolved") {
        trimmedFeedbackCount += 1;
        return false;
      }
      return true;
    });
    return { ...ch, feedbackItems: openOnly };
  });
  candidate = { ...candidate, chapters: trimmedChapters };

  const fits = measure(candidate) <= maxBytes;
  if (fits) {
    return { state: candidate, fits: true, trimmedHistoryCount, trimmedFeedbackCount };
  }

  const fieldSizes: Array<{ label: string; bytes: number }> = [
    ...candidate.chapters.map((c) => ({
      label: c.title,
      bytes: encoder.encode(c.content + c.scenes).byteLength,
    })),
    {
      label: "Story Bible",
      bytes: encoder.encode(JSON.stringify(candidate.storyBible)).byteLength,
    },
  ].sort((a, b) => b.bytes - a.bytes);

  return {
    state: candidate,
    fits: false,
    trimmedHistoryCount,
    trimmedFeedbackCount,
    largestFields: fieldSizes.slice(0, 3).map((f) => f.label),
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
    return { state: remoteState, shouldSyncDraftToServer: false, conflictDetected: false };
  }

  // NC-01 Guard: Never let an empty local draft overwrite a non-empty remote story
  if (!hasUnsavedDraftContent(localEnvelope.state) && hasUnsavedDraftContent(remoteState)) {
    return { state: remoteState, shouldSyncDraftToServer: false, conflictDetected: false };
  }

  if (localEnvelope.baseVersion >= remoteState.version) {
    return {
      state: {
        ...localEnvelope.state,
        version: remoteState.version,
        updatedAt: Math.max(localEnvelope.state.updatedAt, remoteState.updatedAt + 1),
      },
      shouldSyncDraftToServer: true,
      conflictDetected: false,
    };
  }

  // Multi-device / multi-tab conflict: baseVersion < remoteState.version
  const backupCard = buildConflictBackupCard(localEnvelope.state, remoteState, nowMs);
  if (!backupCard) {
    return { state: remoteState, shouldSyncDraftToServer: false, conflictDetected: false };
  }

  const existingBackups: NovelcrafterHistoryCard[] = [];
  const otherCards: NovelcrafterHistoryCard[] = [];
  for (const card of remoteState.historyCards) {
    const isBackup =
      card.actionLabel === CONFLICT_BACKUP_ACTION_LABEL ||
      card.subLabel === CONFLICT_BACKUP_ACTION_LABEL;
    if (isBackup) {
      if (existingBackups.length < MAX_CONFLICT_BACKUP_CARDS - 1) existingBackups.push(card);
    } else {
      otherCards.push(card);
    }
  }

  return {
    state: {
      ...remoteState,
      historyCards: [backupCard, ...existingBackups, ...otherCards].slice(0, MAX_HISTORY_CARDS),
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
  if (options?.markSkipNextGet !== false) coordinator.markSkipInitialGet(newStoryId);
  writeLocalStoryDraft(newStoryId, promotedState, { baseVersion: 1, dirty: true });
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
  if (
    stories.some((s) => s.id === trimmed && (!s.model || s.model === MODEL_IDS.NOVELCRAFTER)) ||
    coordinator?.isCandidateNewStoryId(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

export function countChapterWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

export function resolveStoryLoadFailureState(params: {
  storyId: string;
  defaultChapterTitle: string;
}): { ownerStoryId: string; state: NovelcrafterStoryState } {
  const localEnvelope = readLocalStoryDraft(params.storyId, params.defaultChapterTitle);
  return {
    ownerStoryId: params.storyId,
    state: localEnvelope
      ? localEnvelope.state
      : createDefaultStoryState(params.defaultChapterTitle),
  };
}

export function shouldBlockAutosaveForStory(
  storyId: string | null,
  loadErrorStoryId: string | null
): boolean {
  return Boolean(storyId && loadErrorStoryId && storyId === loadErrorStoryId);
}

export function resolveLoadLockRecoveryAction(
  errorCode?: string | null
): "overwrite_prompt" | "keep_locked" {
  return errorCode === "STORY_STATE_CORRUPTED" ? "overwrite_prompt" : "keep_locked";
}

export function shouldApplyLoadLockRetryResult(params: {
  targetStoryId: string | null;
  currentOwnerStoryId: string | null;
}): boolean {
  return Boolean(
    params.targetStoryId &&
    params.currentOwnerStoryId &&
    params.targetStoryId === params.currentOwnerStoryId
  );
}
