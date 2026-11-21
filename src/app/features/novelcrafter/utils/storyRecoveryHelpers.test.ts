import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import { NovelcrafterSyncCoordinator } from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { TranslationKey } from "@/lib/utils/translations";
import * as draftStorage from "@/lib/features/novelcrafter/draftStorage";
import * as catalog from "../hooks/useNovelcrafterCatalog";
import { toast } from "@/lib/store/toastStore";
import {
  applySavedStoryOutcome,
  tryTrimPayloadAndRetry,
  runStoryConflictRecovery,
  runLockedStoryRetry,
  runReloadAfterDestructiveRejection,
} from "./storyRecoveryHelpers";

const identityT = (key: TranslationKey) => key;

describe("storyRecoveryHelpers (CT-6C-03)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("applySavedStoryOutcome clears dirty flag and updates version + saveStatus", () => {
    const baseState = createDefaultStoryState("Chapter 1");
    const latestStateRef = {
      current: { ownerStoryId: "s-1", state: baseState } as StoryScopedState,
    };
    const dirtyStoryIdsRef = { current: new Set(["s-1"]) };
    const onClearLoadError = vi.fn();
    const setDestructivePrompt = vi.fn();
    const setSaveStatus = vi.fn();
    vi.spyOn(draftStorage, "markLocalDraftSynced").mockReturnValue({
      baseVersion: 4,
      dirty: false,
      savedAt: 1000,
      state: baseState,
    });

    const ok = applySavedStoryOutcome({
      storyId: "s-1",
      version: 4,
      ackedSnapshotUpdatedAt: 1000,
      updatedAt: 1000,
      latestStateRef,
      dirtyStoryIdsRef,
      onClearLoadError,
      setDestructivePrompt,
      setSaveStatus,
    });

    expect(ok).toBe(true);
    expect(onClearLoadError).toHaveBeenCalledWith("s-1");
    expect(dirtyStoryIdsRef.current.has("s-1")).toBe(false);
    expect(latestStateRef.current.state.version).toBe(4);
    expect(setSaveStatus).toHaveBeenCalledWith("saved");
  });

  it("tryTrimPayloadAndRetry retries with trimmed state or toasts when still too large", async () => {
    const baseState = createDefaultStoryState("Chapter 1");
    const trimmedState = { ...baseState, historyCards: [] };
    const coordinator = new NovelcrafterSyncCoordinator();
    const latestStateRef = {
      current: { ownerStoryId: "s-1", state: baseState } as StoryScopedState,
    };
    const setStoryState = vi.fn();
    const executeSave = vi.fn().mockResolvedValue(true);

    vi.spyOn(draftStorage, "enforceStatePayloadBudget").mockReturnValueOnce({
      fits: true,
      state: trimmedState,
      trimmedHistoryCount: 2,
      trimmedSnapshotCount: 0,
      trimmedFeedbackCount: 0,
    });

    const retriedRes = await tryTrimPayloadAndRetry({
      storyId: "s-1",
      stateToSave: baseState,
      isManual: true,
      coordinator,
      latestStateRef,
      setStoryState,
      executeSave,
      t: identityT,
    });
    expect(retriedRes).toEqual({ retried: true, saved: true });
    expect(setStoryState).toHaveBeenCalledWith(trimmedState);
    expect(executeSave).toHaveBeenCalledWith(
      "s-1",
      trimmedState,
      expect.objectContaining({ isRetryAfterTrim: true, isManual: true })
    );

    const toastErr = vi.spyOn(toast, "error").mockImplementation(() => "t-id");
    vi.spyOn(draftStorage, "enforceStatePayloadBudget").mockReturnValueOnce({
      fits: false,
      state: baseState,
      trimmedHistoryCount: 0,
      trimmedSnapshotCount: 0,
      trimmedFeedbackCount: 0,
    });

    const tooLargeRes = await tryTrimPayloadAndRetry({
      storyId: "s-1",
      stateToSave: baseState,
      coordinator,
      latestStateRef,
      setStoryState,
      executeSave,
      t: identityT,
    });
    expect(tooLargeRes).toEqual({ retried: false, saved: false });
    expect(toastErr).toHaveBeenCalledWith("novelcrafterPayloadTooLargeError");
  });

  it("runStoryConflictRecovery fetches remote, reconciles, and triggers executeSave when draft needs sync", async () => {
    const remoteState = { ...createDefaultStoryState("Chapter 1"), version: 5, updatedAt: 500 };
    const localState = { ...createDefaultStoryState("Chapter 1"), version: 3, updatedAt: 900 };
    const coordinator = new NovelcrafterSyncCoordinator();
    const latestStateRef = {
      current: { ownerStoryId: "s-1", state: localState } as StoryScopedState,
    };
    const dirtyStoryIdsRef = { current: new Set(["s-1"]) };
    const setStoryState = vi.fn();
    const setSaveStatus = vi.fn();
    const cancelPendingSaveTimers = vi.fn();
    const executeSave = vi.fn().mockResolvedValue(true);

    vi.spyOn(catalog, "fetchRemoteStoryState").mockResolvedValue(remoteState);
    vi.spyOn(draftStorage, "reconcileStoryStateWithDraft").mockReturnValue({
      state: localState,
      conflictDetected: true,
      shouldSyncDraftToServer: true,
    });
    vi.spyOn(draftStorage, "writeLocalStoryDraft").mockReturnValue(true);
    const toastInfo = vi.spyOn(toast, "info").mockImplementation(() => "t-info");

    const ok = await runStoryConflictRecovery({
      storyId: "s-1",
      unsavedState: localState,
      isManual: true,
      coordinator,
      latestStateRef,
      dirtyStoryIdsRef,
      setStoryState,
      setSaveStatus,
      cancelPendingSaveTimers,
      executeSave,
      t: identityT,
    });

    expect(ok).toBe(true);
    expect(toastInfo).toHaveBeenCalledWith("novelcrafterConflictBackupNotice");
    expect(executeSave).toHaveBeenCalledWith(
      "s-1",
      localState,
      expect.objectContaining({ isManual: true })
    );
  });

  it("runLockedStoryRetry handles corrupted_remote overwrite_prompt and respects stale story guard", async () => {
    const localState = createDefaultStoryState("Chapter 1");
    localState.chapters[0].content = "Local prose";
    const coordinator = new NovelcrafterSyncCoordinator();
    const latestStateRef = {
      current: { ownerStoryId: "s-1", state: localState } as StoryScopedState,
    };
    const dirtyStoryIdsRef = { current: new Set<string>() };
    const isRetryingLockedStoryRef = { current: null as string | null };
    const setStoryState = vi.fn();
    const setSaveStatus = vi.fn();
    const setDestructivePrompt = vi.fn();
    const executeSave = vi.fn().mockResolvedValue(true);

    vi.spyOn(catalog, "fetchRemoteStoryState").mockRejectedValueOnce(
      new catalog.StoryLoadError("Corrupted remote", 422, "STORY_STATE_CORRUPTED")
    );

    await runLockedStoryRetry({
      targetStoryId: "s-1",
      currentState: localState,
      coordinator,
      latestStateRef,
      dirtyStoryIdsRef,
      isRetryingLockedStoryRef,
      setStoryState,
      setSaveStatus,
      setDestructivePrompt,
      executeSave,
      t: identityT,
    });

    expect(setDestructivePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        storyId: "s-1",
        reason: "corrupted_remote",
        nextChars: "Local prose".length,
      })
    );
    expect(isRetryingLockedStoryRef.current).toBeNull();

    // Stale story switch: user switched to s-2 while s-1 retry failed -> ignore error UI
    latestStateRef.current = { ownerStoryId: "s-2", state: localState };
    setSaveStatus.mockClear();
    vi.spyOn(catalog, "fetchRemoteStoryState").mockRejectedValueOnce(new Error("Network error"));
    await runLockedStoryRetry({
      targetStoryId: "s-1",
      currentState: localState,
      coordinator,
      latestStateRef,
      dirtyStoryIdsRef,
      isRetryingLockedStoryRef,
      setStoryState,
      setSaveStatus,
      setDestructivePrompt,
      executeSave,
      t: identityT,
    });
    expect(setSaveStatus).not.toHaveBeenCalled();
  });

  it("runReloadAfterDestructiveRejection dismisses corrupted_remote or reloads remote state", async () => {
    const baseState = createDefaultStoryState("Chapter 1");
    const remoteState = { ...baseState, version: 9, updatedAt: 999 };
    const coordinator = new NovelcrafterSyncCoordinator();
    const latestStateRef = {
      current: { ownerStoryId: "s-1", state: baseState } as StoryScopedState,
    };
    const setDestructivePrompt = vi.fn();
    const setStoryState = vi.fn();
    const setSaveStatus = vi.fn();

    await runReloadAfterDestructiveRejection({
      destructivePrompt: {
        storyId: "s-1",
        previousChars: 0,
        nextChars: 10,
        pendingState: baseState,
        reason: "corrupted_remote",
      },
      coordinator,
      latestStateRef,
      setDestructivePrompt,
      setStoryState,
      setSaveStatus,
      t: identityT,
    });
    expect(setDestructivePrompt).toHaveBeenCalledWith(null);
    expect(setStoryState).not.toHaveBeenCalled();

    vi.spyOn(catalog, "fetchRemoteStoryState").mockResolvedValueOnce(remoteState);
    vi.spyOn(draftStorage, "writeLocalStoryDraft").mockReturnValue(true);

    await runReloadAfterDestructiveRejection({
      destructivePrompt: {
        storyId: "s-1",
        previousChars: 100,
        nextChars: 10,
        pendingState: baseState,
        reason: "destructive_drop",
      },
      coordinator,
      latestStateRef,
      setDestructivePrompt,
      setStoryState,
      setSaveStatus,
      t: identityT,
    });
    expect(setStoryState).toHaveBeenCalledWith(remoteState);
    expect(setSaveStatus).toHaveBeenCalledWith("saved");
  });
});
