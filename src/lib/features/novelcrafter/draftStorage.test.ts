// /lib/features/novelcrafter/draftStorage.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFLICT_BACKUP_ACTION_LABEL,
  countChapterWords,
  DRAFT_LRU_INDEX_KEY,
  enforceStatePayloadBudget,
  getDraftStorageKey,
  hasUnsavedDraftContent,
  markLocalDraftSynced,
  MAX_CONFLICT_BACKUP_CARD_CHARS,
  MAX_CONFLICT_BACKUP_CARDS,
  promoteUnsavedDraftToStory,
  readLocalStoryDraft,
  reconcileStoryStateWithDraft,
  removeLocalStoryDraft,
  resolveValidNovelcrafterStoryId,
  UNSAVED_DRAFT_STORAGE_KEY,
  writeLocalStoryDraft,
} from "./draftStorage";
import { NovelcrafterSyncCoordinator } from "./storySyncCoordinator";
import { createDefaultStoryState } from "./types";

describe("draftStorage (TC-02 & TC-03)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("TC-02 Case 2A (M10): restores dirty local draft with matching baseVersion even when client clock is behind server clock", () => {
    const remoteState = {
      ...createDefaultStoryState(),
      version: 2,
      updatedAt: 20_000,
    };
    const draftState = {
      ...createDefaultStoryState(),
      version: 1,
      updatedAt: 10_000, // 10s behind server clock
    };
    draftState.chapters[0].content = "Offline draft text";

    const reconciled = reconcileStoryStateWithDraft(
      remoteState,
      {
        baseVersion: 2,
        dirty: true,
        savedAt: 10_000,
        state: draftState,
      },
      10_000
    );

    expect(reconciled.shouldSyncDraftToServer).toBe(true);
    expect(reconciled.conflictDetected).toBe(false);
    expect(reconciled.state.version).toBe(2);
    expect(reconciled.state.updatedAt).toBe(20_001);
    expect(reconciled.state.chapters[0].content).toBe("Offline draft text");
  });

  it("TC-02 Case 2B (M11.3, M18, m23b): preserves both storyBible and chapter diffs in conflictBackupCard capped at 16,000 chars and max 3 backup cards", () => {
    const remoteState = {
      ...createDefaultStoryState(),
      version: 5,
      updatedAt: 50_000,
    };
    remoteState.storyBible.synopsis = "Remote synopsis";
    remoteState.chapters[0].content = "Remote prose";
    remoteState.historyCards = [1, 2, 3].map((i) => ({
      id: `old-backup-${i}`,
      feature: "write" as const,
      actionLabel: CONFLICT_BACKUP_ACTION_LABEL,
      subLabel: CONFLICT_BACKUP_ACTION_LABEL,
      content: `Old backup ${i}`,
      model: remoteState.selectedModel,
      createdAt: i * 1000,
    }));

    const localState = {
      ...createDefaultStoryState(),
      version: 3,
      updatedAt: 40_000,
    };
    localState.storyBible.synopsis = "Local modified synopsis";
    localState.chapters[0].content = "A".repeat(20_000);

    const reconciled = reconcileStoryStateWithDraft(
      remoteState,
      {
        baseVersion: 3,
        dirty: true,
        savedAt: 40_000,
        state: localState,
      },
      60_000
    );

    expect(reconciled.conflictDetected).toBe(true);
    expect(reconciled.shouldSyncDraftToServer).toBe(true);
    expect(reconciled.state.chapters[0].content).toBe("Remote prose");

    const backupCards = reconciled.state.historyCards.filter(
      (c) => c.actionLabel === CONFLICT_BACKUP_ACTION_LABEL
    );
    expect(backupCards.length).toBe(MAX_CONFLICT_BACKUP_CARDS);
    expect(backupCards[0].content).toContain("Local modified synopsis");
    expect(backupCards[0].content.length).toBeLessThanOrEqual(MAX_CONFLICT_BACKUP_CARD_CHARS);

    // m23b: writing reconciled state with dirty: true keeps backup card safe until PUT ack
    writeLocalStoryDraft("story-1", reconciled.state, {
      baseVersion: remoteState.version,
      dirty: true,
    });
    expect(readLocalStoryDraft("story-1")?.dirty).toBe(true);

    markLocalDraftSynced("story-1", 6, reconciled.state.updatedAt, 65_000);
    expect(readLocalStoryDraft("story-1")?.dirty).toBe(false);
  });

  it("TC-02 Case 2C: enforces LRU eviction keeping at most 5 story drafts in localStorage", () => {
    const state = createDefaultStoryState();
    for (let i = 1; i <= 6; i++) {
      writeLocalStoryDraft(`story-${i}`, state, { baseVersion: 1, dirty: true });
    }

    expect(readLocalStoryDraft("story-1")).toBeNull();
    expect(readLocalStoryDraft("story-6")).not.toBeNull();

    const lruRaw = window.localStorage.getItem(DRAFT_LRU_INDEX_KEY);
    const lruList = JSON.parse(lruRaw || "[]") as string[];
    expect(lruList.length).toBe(5);
    expect(lruList[0]).toBe("story-6");
  });

  it("TC-02 Case 2D (M11.2): markLocalDraftSynced keeps dirty=true and bumps updatedAt if user typed during in-flight PUT", () => {
    const stateAtTyping = {
      ...createDefaultStoryState(),
      version: 1,
      updatedAt: 1200,
    };
    stateAtTyping.chapters[0].content = "Typed while PUT #1 was in flight";

    writeLocalStoryDraft("story-1", stateAtTyping, { baseVersion: 1, dirty: true });

    const updatedEnvelope = markLocalDraftSynced("story-1", 2, 1000, 1300);
    expect(updatedEnvelope?.dirty).toBe(true);
    expect(updatedEnvelope?.baseVersion).toBe(2);
    expect(updatedEnvelope?.state.updatedAt).toBe(1301);
  });

  it("TC-02 Case 2E & 2G (M18, m20): enforceStatePayloadBudget trims historyCards to fit budget and stops without truncating chapters if chapters alone exceed budget", () => {
    const state = createDefaultStoryState();
    state.historyCards = Array.from({ length: 10 }, (_, idx) => ({
      id: `card-${idx}`,
      feature: "write" as const,
      content: "X".repeat(2_000),
      model: state.selectedModel,
      createdAt: idx,
    }));

    const trimmed = enforceStatePayloadBudget(state, 10_000);
    expect(trimmed.fits).toBe(true);
    expect(trimmed.state.historyCards.length).toBeLessThan(10);

    // Case 2G: chapter content alone exceeds maxBytes
    const hugeChapterState = createDefaultStoryState();
    hugeChapterState.chapters[0].content = "Z".repeat(15_000);
    const cannotFit = enforceStatePayloadBudget(hugeChapterState, 5_000);
    expect(cannotFit.fits).toBe(false);
    expect(cannotFit.state.chapters[0].content.length).toBe(15_000);
  });

  it("TC-02 Case 2F (m18 — Timeline O): returns conflictDetected=false and no empty backup card when local and remote contents are identical", () => {
    const baseState = createDefaultStoryState();
    baseState.chapters[0].content = "Identical chapter text";

    const remoteState = {
      ...baseState,
      version: 6,
      updatedAt: baseState.updatedAt + 500,
    };

    const reconciled = reconcileStoryStateWithDraft(remoteState, {
      baseVersion: 5,
      dirty: true,
      savedAt: baseState.updatedAt,
      state: baseState,
    });

    expect(reconciled.conflictDetected).toBe(false);
    expect(reconciled.shouldSyncDraftToServer).toBe(false);
    expect(reconciled.state.historyCards.length).toBe(0);
  });

  it("TC-03 Case 3A, 3B, 3C (M19, m24): promotes unsaved draft, consumes skipInitialGet once, validates story IDs, and counts words", () => {
    const coordinator = new NovelcrafterSyncCoordinator();
    const unsaved = createDefaultStoryState();
    unsaved.chapters[0].content = "First words on blank page";
    writeLocalStoryDraft(null, unsaved, { baseVersion: 1, dirty: true });
    expect(window.localStorage.getItem(UNSAVED_DRAFT_STORAGE_KEY)).not.toBeNull();

    promoteUnsavedDraftToStory("new-story-1", unsaved, coordinator, { markSkipNextGet: true });
    expect(window.localStorage.getItem(UNSAVED_DRAFT_STORAGE_KEY)).toBeNull();
    expect(readLocalStoryDraft("new-story-1")?.state.chapters[0].content).toBe(
      "First words on blank page"
    );

    expect(coordinator.consumeSkipInitialGet("new-story-1")).toBe(true);
    expect(coordinator.consumeSkipInitialGet("new-story-1")).toBe(false);

    // Case 3A: resolveValidNovelcrafterStoryId
    const stories = [{ id: "nc-1", model: "vikini-novelcrafter" }];
    expect(resolveValidNovelcrafterStoryId("chat-999", stories, coordinator)).toBeNull();
    expect(resolveValidNovelcrafterStoryId("nc-1", stories, coordinator)).toBe("nc-1");

    // Case 3C: hasUnsavedDraftContent & countChapterWords
    expect(hasUnsavedDraftContent(createDefaultStoryState())).toBe(false);
    expect(hasUnsavedDraftContent(unsaved)).toBe(true);
    expect(countChapterWords("  Chương mở đầu:\nÁnh trăng   chiếu sáng.  ")).toBe(7);
    expect(countChapterWords("  Chương đầu:\nÁnh trăng   chiếu sáng.  ")).toBe(6);
    expect(countChapterWords("   \n\t  ")).toBe(0);

    expect(getDraftStorageKey(null)).toBe(UNSAVED_DRAFT_STORAGE_KEY);
    expect(getDraftStorageKey("new-story-1")).toBe("vikini:novelcrafter:draft:new-story-1");
    removeLocalStoryDraft("new-story-1");
    expect(readLocalStoryDraft("new-story-1")).toBeNull();
  });
});
