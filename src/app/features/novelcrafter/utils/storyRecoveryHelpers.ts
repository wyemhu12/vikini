import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  enforceStatePayloadBudget,
  markLocalDraftSynced,
  readLocalStoryDraft,
  reconcileStoryStateWithDraft,
  resolveLoadLockRecoveryAction,
  shouldApplyLoadLockRetryResult,
  writeLocalStoryDraft,
} from "@/lib/features/novelcrafter/draftStorage";
import type {
  NovelcrafterSyncCoordinator,
  StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { fetchRemoteStoryState, StoryLoadError } from "../hooks/useNovelcrafterCatalog";

const recoveryLogger = logger.withContext("storyRecoveryHelpers");
export const FALLBACK_TRIM_PAYLOAD_BYTES = 1_500_000;

export interface DestructiveSavePromptState {
  storyId: string;
  previousChars: number;
  nextChars: number;
  pendingState: NovelcrafterStoryState;
  reason?: "destructive_drop" | "corrupted_remote";
}

export type ExecuteCoordinatorSaveFn = (
  storyId: string,
  stateToSave: NovelcrafterStoryState,
  options?: {
    epoch?: number;
    isManual?: boolean;
    isRetryAfterTrim?: boolean;
    allowDestructive?: boolean;
  }
) => Promise<boolean>;

export function applySavedStoryOutcome(params: {
  storyId: string;
  version: number;
  ackedSnapshotUpdatedAt: number;
  updatedAt: number;
  latestStateRef: MutableRefObject<StoryScopedState>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  onClearLoadError?: (storyId: string) => void;
  setDestructivePrompt: Dispatch<SetStateAction<DestructiveSavePromptState | null>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
}): boolean {
  const {
    storyId,
    version,
    ackedSnapshotUpdatedAt,
    updatedAt,
    latestStateRef,
    dirtyStoryIdsRef,
    onClearLoadError,
    setDestructivePrompt,
    setSaveStatus,
  } = params;

  onClearLoadError?.(storyId);
  setDestructivePrompt((prev) => (prev?.storyId === storyId ? null : prev));
  const syncedEnv = markLocalDraftSynced(storyId, version, ackedSnapshotUpdatedAt, updatedAt);
  if (!syncedEnv?.dirty) dirtyStoryIdsRef.current.delete(storyId);
  if (latestStateRef.current.ownerStoryId === storyId) {
    latestStateRef.current.state = {
      ...latestStateRef.current.state,
      version,
    };
    setSaveStatus(syncedEnv?.dirty ? "unsaved" : "saved");
  }
  return true;
}

export async function tryTrimPayloadAndRetry(params: {
  storyId: string;
  stateToSave: NovelcrafterStoryState;
  isManual?: boolean;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  executeSave: ExecuteCoordinatorSaveFn;
  t: (key: TranslationKey) => string;
}): Promise<{ retried: boolean; saved: boolean }> {
  const {
    storyId,
    stateToSave,
    isManual,
    coordinator,
    latestStateRef,
    setStoryState,
    executeSave,
    t,
  } = params;

  const latestSourceState =
    latestStateRef.current.ownerStoryId === storyId ? latestStateRef.current.state : stateToSave;
  const trimmed = enforceStatePayloadBudget(latestSourceState, FALLBACK_TRIM_PAYLOAD_BYTES);

  if (trimmed.fits && (trimmed.trimmedHistoryCount > 0 || trimmed.trimmedFeedbackCount > 0)) {
    if (latestStateRef.current.ownerStoryId === storyId) {
      latestStateRef.current = { ownerStoryId: storyId, state: trimmed.state };
      setStoryState(trimmed.state);
    }
    const saved = await executeSave(storyId, trimmed.state, {
      epoch: coordinator.getEpoch(storyId),
      isManual,
      isRetryAfterTrim: true,
    });
    return { retried: true, saved };
  }

  toast.error(t("novelcrafterPayloadTooLargeError"));
  return { retried: false, saved: false };
}

export async function runStoryConflictRecovery(params: {
  storyId: string;
  unsavedState: NovelcrafterStoryState;
  isManual?: boolean;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  cancelPendingSaveTimers: () => void;
  executeSave: ExecuteCoordinatorSaveFn;
  t: (key: TranslationKey) => string;
}): Promise<boolean> {
  const {
    storyId,
    unsavedState,
    isManual,
    coordinator,
    latestStateRef,
    dirtyStoryIdsRef,
    setStoryState,
    setSaveStatus,
    cancelPendingSaveTimers,
    executeSave,
    t,
  } = params;

  cancelPendingSaveTimers();
  try {
    const recoveryResult = await coordinator.runConflictRecovery(storyId, async () => {
      const remoteState = await fetchRemoteStoryState(
        storyId,
        t("novelcrafterDefaultChapterTitle"),
        t("novelcrafterLoadError")
      );
      coordinator.seedServerMeta(storyId, {
        version: remoteState.version,
        updatedAt: remoteState.updatedAt,
      });
      const postReconcileEpoch = coordinator.bumpEpoch(storyId);
      cancelPendingSaveTimers();
      const candidateLocalState =
        latestStateRef.current.ownerStoryId === storyId
          ? latestStateRef.current.state
          : unsavedState;
      const reconciled = reconcileStoryStateWithDraft(remoteState, {
        baseVersion: 0,
        dirty: true,
        savedAt: Date.now(),
        state: candidateLocalState,
      });
      if (latestStateRef.current.ownerStoryId === storyId) {
        latestStateRef.current = { ownerStoryId: storyId, state: reconciled.state };
        setStoryState(reconciled.state);
      }
      writeLocalStoryDraft(storyId, reconciled.state, {
        baseVersion: remoteState.version,
        dirty: reconciled.shouldSyncDraftToServer,
      });
      return { ...reconciled, postReconcileEpoch };
    });

    if (recoveryResult.conflictDetected) toast.info(t("novelcrafterConflictBackupNotice"));
    if (recoveryResult.shouldSyncDraftToServer) {
      return await executeSave(storyId, recoveryResult.state, {
        epoch: recoveryResult.postReconcileEpoch,
        isManual,
      });
    }
    dirtyStoryIdsRef.current.delete(storyId);
    if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("saved");
    return true;
  } catch (err: unknown) {
    recoveryLogger.error("Conflict recovery failed:", err);
    if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("error");
    return false;
  }
}

export async function runLockedStoryRetry(params: {
  targetStoryId: string;
  currentState: NovelcrafterStoryState;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  isRetryingLockedStoryRef: MutableRefObject<string | null>;
  onClearLoadError?: (storyId: string) => void;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  setDestructivePrompt: Dispatch<SetStateAction<DestructiveSavePromptState | null>>;
  executeSave: ExecuteCoordinatorSaveFn;
  t: (key: TranslationKey) => string;
}): Promise<void> {
  const {
    targetStoryId,
    currentState,
    coordinator,
    latestStateRef,
    dirtyStoryIdsRef,
    isRetryingLockedStoryRef,
    onClearLoadError,
    setStoryState,
    setSaveStatus,
    setDestructivePrompt,
    executeSave,
    t,
  } = params;

  if (isRetryingLockedStoryRef.current === targetStoryId) return;
  isRetryingLockedStoryRef.current = targetStoryId;
  const snapshotStateForRecovery =
    latestStateRef.current.ownerStoryId === targetStoryId
      ? latestStateRef.current.state
      : (readLocalStoryDraft(targetStoryId, t("novelcrafterDefaultChapterTitle"))?.state ??
        currentState);

  try {
    const remoteState = await fetchRemoteStoryState(
      targetStoryId,
      t("novelcrafterDefaultChapterTitle"),
      t("novelcrafterLoadError")
    );
    coordinator.seedServerMeta(targetStoryId, {
      version: remoteState.version,
      updatedAt: remoteState.updatedAt,
    });
    const postReconcileEpoch = coordinator.bumpEpoch(targetStoryId);
    const localEnvelope = readLocalStoryDraft(targetStoryId, t("novelcrafterDefaultChapterTitle"));
    const reconciled = reconcileStoryStateWithDraft(remoteState, localEnvelope);
    writeLocalStoryDraft(targetStoryId, reconciled.state, {
      baseVersion: remoteState.version,
      dirty: reconciled.shouldSyncDraftToServer,
    });
    onClearLoadError?.(targetStoryId);

    const stillOnTargetStory = shouldApplyLoadLockRetryResult({
      targetStoryId,
      currentOwnerStoryId: latestStateRef.current.ownerStoryId,
    });
    if (stillOnTargetStory) {
      latestStateRef.current = { ownerStoryId: targetStoryId, state: reconciled.state };
      setStoryState(reconciled.state);
      if (reconciled.conflictDetected) toast.info(t("novelcrafterConflictBackupNotice"));
    }
    if (reconciled.shouldSyncDraftToServer) {
      dirtyStoryIdsRef.current.add(targetStoryId);
      await executeSave(targetStoryId, reconciled.state, {
        epoch: postReconcileEpoch,
        isManual: true,
      });
    } else {
      dirtyStoryIdsRef.current.delete(targetStoryId);
      if (stillOnTargetStory) setSaveStatus("saved");
    }
  } catch (err: unknown) {
    if (
      !shouldApplyLoadLockRetryResult({
        targetStoryId,
        currentOwnerStoryId: latestStateRef.current.ownerStoryId,
      })
    ) {
      return;
    }
    const action = resolveLoadLockRecoveryAction(
      err instanceof StoryLoadError ? err.code : undefined
    );
    if (action === "overwrite_prompt") {
      setDestructivePrompt({
        storyId: targetStoryId,
        previousChars: 0,
        nextChars: snapshotStateForRecovery.chapters.reduce(
          (acc, ch) => acc + ch.content.length,
          0
        ),
        pendingState: snapshotStateForRecovery,
        reason: "corrupted_remote",
      });
    } else {
      setSaveStatus("error");
      toast.error(t("novelcrafterLoadError"));
    }
  } finally {
    if (isRetryingLockedStoryRef.current === targetStoryId) {
      isRetryingLockedStoryRef.current = null;
    }
  }
}

export async function runReloadAfterDestructiveRejection(params: {
  destructivePrompt: DestructiveSavePromptState | null;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  setDestructivePrompt: Dispatch<SetStateAction<DestructiveSavePromptState | null>>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  t: (key: TranslationKey) => string;
}): Promise<void> {
  const {
    destructivePrompt,
    coordinator,
    latestStateRef,
    setDestructivePrompt,
    setStoryState,
    setSaveStatus,
    t,
  } = params;

  if (!destructivePrompt) return;
  if (destructivePrompt.reason === "corrupted_remote") {
    setDestructivePrompt(null);
    return;
  }

  const { storyId } = destructivePrompt;
  setDestructivePrompt(null);
  try {
    const remoteState = await fetchRemoteStoryState(
      storyId,
      t("novelcrafterDefaultChapterTitle"),
      t("novelcrafterLoadError")
    );
    coordinator.seedServerMeta(storyId, {
      version: remoteState.version,
      updatedAt: remoteState.updatedAt,
    });
    coordinator.bumpEpoch(storyId);
    if (latestStateRef.current.ownerStoryId === storyId) {
      latestStateRef.current = { ownerStoryId: storyId, state: remoteState };
      setStoryState(remoteState);
      setSaveStatus("saved");
    }
    writeLocalStoryDraft(storyId, remoteState, {
      baseVersion: remoteState.version,
      dirty: false,
    });
  } catch (err: unknown) {
    recoveryLogger.error("Failed to reload after destructive save rejection:", err);
    toast.error(t("novelcrafterLoadError"));
  }
}
