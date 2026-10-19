// /lib/features/novelcrafter/draftStorage.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFLICT_BACKUP_ACTION_LABEL,
  countChapterWords,
  createChapterSnapshot,
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
  resolveLoadLockRecoveryAction,
  resolveStoryLoadFailureState,
  resolveValidNovelcrafterStoryId,
  shouldApplyLoadLockRetryResult,
  shouldBlockAutosaveForStory,
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

  it("TC-03B (Cases 3B-1..3B-5) & structured card conflict backup: isolates failed story loads, blocks autosave on locked stories, and detects structured card diffs", () => {
    // Case 3B-1: story without local draft returns clean default state with ownerStoryId = story-err-1
    const fallback1 = resolveStoryLoadFailureState({
      storyId: "story-err-1",
      defaultChapterTitle: "Chương 1",
    });
    expect(fallback1.ownerStoryId).toBe("story-err-1");
    expect(fallback1.state.chapters[0].content).toBe("");

    // Case 3B-2: story with existing local draft preserves local draft state
    const localSaved = createDefaultStoryState("Chương Local");
    localSaved.chapters[0].content = "Nội dung bản nháp local được giữ lại";
    writeLocalStoryDraft("story-err-2", localSaved, { baseVersion: 2, dirty: true });

    const fallback2 = resolveStoryLoadFailureState({
      storyId: "story-err-2",
      defaultChapterTitle: "Chương 1",
    });
    expect(fallback2.ownerStoryId).toBe("story-err-2");
    expect(fallback2.state.chapters[0].content).toBe("Nội dung bản nháp local được giữ lại");

    // Case 3B-3: shouldBlockAutosaveForStory
    expect(shouldBlockAutosaveForStory("story-err-1", "story-err-1")).toBe(true);
    expect(shouldBlockAutosaveForStory("story-ok", "story-err-1")).toBe(false);
    expect(shouldBlockAutosaveForStory("story-ok", null)).toBe(false);
    expect(shouldBlockAutosaveForStory(null, "story-err-1")).toBe(false);

    // Case 3B-4: resolveLoadLockRecoveryAction
    expect(resolveLoadLockRecoveryAction("STORY_STATE_CORRUPTED")).toBe("overwrite_prompt");
    expect(resolveLoadLockRecoveryAction("DATABASE_ERROR")).toBe("keep_locked");
    expect(resolveLoadLockRecoveryAction("RATE_LIMIT_EXCEEDED")).toBe("keep_locked");
    expect(resolveLoadLockRecoveryAction(undefined)).toBe("keep_locked");
    expect(resolveLoadLockRecoveryAction(null)).toBe("keep_locked");

    // Case 3B-5: shouldApplyLoadLockRetryResult
    expect(
      shouldApplyLoadLockRetryResult({
        targetStoryId: "story-a",
        currentOwnerStoryId: "story-a",
      })
    ).toBe(true);
    expect(
      shouldApplyLoadLockRetryResult({
        targetStoryId: "story-a",
        currentOwnerStoryId: "story-b",
      })
    ).toBe(false);
    expect(
      shouldApplyLoadLockRetryResult({
        targetStoryId: "story-a",
        currentOwnerStoryId: null,
      })
    ).toBe(false);
    expect(
      shouldApplyLoadLockRetryResult({
        targetStoryId: null,
        currentOwnerStoryId: "story-a",
      })
    ).toBe(false);

    // Structured cards & extraInstructions conflict backup detection
    const remoteState = {
      ...createDefaultStoryState(),
      version: 4,
      updatedAt: 40_000,
    };
    const localWithCards = {
      ...createDefaultStoryState(),
      version: 2,
      updatedAt: 20_000,
    };
    localWithCards.storyBible.characterCards = [
      { id: "c1", name: "Kael", role: "Mage", traits: "Fierce", visibleToAI: false },
    ];
    localWithCards.chapters[0].extraInstructions = "Keep dialogue sharp";

    const reconciledCards = reconcileStoryStateWithDraft(remoteState, {
      baseVersion: 2,
      dirty: true,
      savedAt: 20_000,
      state: localWithCards,
    });
    expect(reconciledCards.conflictDetected).toBe(true);
    expect(reconciledCards.state.historyCards[0]?.content).toContain("Kael");
    expect(reconciledCards.state.historyCards[0]?.content).toContain("Keep dialogue sharp");
  });

  it("TC-306: creates deduplicated chapter snapshots (FIFO max 5) and trims oldest snapshots in Tier 2 payload budget without touching active chapter prose", () => {
    const state = createDefaultStoryState();
    const ch = state.chapters[0];
    ch.content = "Phiên bản một của chương.";

    const firstSnaps = createChapterSnapshot(ch, "Bản 1", 1000);
    expect(firstSnaps).toHaveLength(1);
    expect(firstSnaps[0].label).toBe("Bản 1");

    // Identical content updates timestamp/label on the top snapshot instead of duplicating
    const dedupedSnaps = createChapterSnapshot(
      { ...ch, snapshots: firstSnaps },
      "Bản 1 cập nhật",
      2000
    );
    expect(dedupedSnaps).toHaveLength(1);
    expect(dedupedSnaps[0].label).toBe("Bản 1 cập nhật");

    // FIFO cap at 5 snapshots
    let currentSnaps = dedupedSnaps;
    for (let i = 2; i <= 6; i++) {
      currentSnaps = createChapterSnapshot(
        { ...ch, content: `Nội dung lần ${i} `.repeat(300), snapshots: currentSnaps },
        `Bản ${i}`,
        i * 1000
      );
    }
    expect(currentSnaps).toHaveLength(5);
    expect(currentSnaps[0].label).toBe("Bản 6");

    // Tier 2 budget trimming removes oldest snapshots when historyCards are already empty
    state.chapters[0].content = "Bản thảo chính hiện tại phải giữ nguyên.";
    state.chapters[0].snapshots = currentSnaps;
    const budgetResult = enforceStatePayloadBudget(state, 8_000);
    expect(budgetResult.fits).toBe(true);
    expect(budgetResult.trimmedSnapshotCount).toBeGreaterThan(0);
    expect(budgetResult.state.chapters[0].content).toBe("Bản thảo chính hiện tại phải giữ nguyên.");

    // Summary counts as unsaved draft content
    const summaryOnlyState = createDefaultStoryState();
    summaryOnlyState.chapters[0].summary = "Tóm tắt chương 1";
    expect(hasUnsavedDraftContent(summaryOnlyState)).toBe(true);
  });
});
