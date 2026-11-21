// /app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts
"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "@/lib/store/toastStore";
import { writeLocalStoryDraft } from "@/lib/features/novelcrafter/draftStorage";
import {
  resolveSaveFailurePresentation,
  type NovelcrafterSyncCoordinator,
  type StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { putStoryStateOnServer } from "./useNovelcrafterCatalog";
import {
  applySavedStoryOutcome,
  runStoryConflictRecovery,
  tryTrimPayloadAndRetry,
  type DestructiveSavePromptState,
} from "../utils/storyRecoveryHelpers";
import { useStoryRecoveryActions } from "./useStoryRecoveryActions";
import { useStorySaveTriggers } from "./useStorySaveTriggers";
import { useStoryLifecycleListeners } from "./useStoryLifecycleListeners";

export type { DestructiveSavePromptState };

interface UseStoryPersistenceLifecycleParams {
  isAuthed: boolean;
  validStoryId: string | null;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  loadErrorStoryIdRef: MutableRefObject<string | null>;
  onClearLoadError?: (storyId: string) => void;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  ensureActiveStory: (seedState?: NovelcrafterStoryState) => Promise<string | null>;
  t: (key: TranslationKey) => string;
}

export function useStoryPersistenceLifecycle(params: UseStoryPersistenceLifecycleParams) {
  const {
    isAuthed,
    validStoryId,
    coordinator,
    latestStateRef,
    loadErrorStoryIdRef,
    onClearLoadError,
    setStoryState,
    setSaveStatus,
    ensureActiveStory,
    t,
  } = params;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyStoryIdsRef = useRef<Set<string>>(new Set());
  const quotaWarningShownRef = useRef(false);
  const isRetryingLockedStoryRef = useRef<string | null>(null);
  const [destructivePrompt, setDestructivePrompt] = useState<DestructiveSavePromptState | null>(
    null
  );

  const cancelPendingSaveTimers = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    saveTimerRef.current = null;
    retryTimerRef.current = null;
  }, []);

  const flushLocalDraftSync = useCallback(
    (targetStoryId: string | null, stateToWrite: NovelcrafterStoryState): boolean => {
      if (draftThrottleTimerRef.current) clearTimeout(draftThrottleTimerRef.current);
      draftThrottleTimerRef.current = null;
      const baseVersion = targetStoryId
        ? (coordinator.getServerMeta(targetStoryId)?.version ?? stateToWrite.version)
        : stateToWrite.version;
      const ok = writeLocalStoryDraft(targetStoryId, stateToWrite, { baseVersion, dirty: true });
      const quotaExceeded = !ok && typeof window !== "undefined";
      if (quotaExceeded && !quotaWarningShownRef.current) {
        quotaWarningShownRef.current = true;
        toast.info(t("novelcrafterLocalStorageQuotaWarning"));
      }
      return quotaExceeded;
    },
    [coordinator, t]
  );

  const executeCoordinatorSave = useCallback(
    async (
      storyId: string,
      stateToSave: NovelcrafterStoryState,
      options?: {
        epoch?: number;
        isManual?: boolean;
        isRetryAfterTrim?: boolean;
        allowDestructive?: boolean;
      }
    ): Promise<boolean> => {
      if (!isAuthed || !storyId) return false;
      if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("saving");
      const sendPut = (id: string, st: NovelcrafterStoryState) =>
        putStoryStateOnServer(id, st, t("novelcrafterSaveError"), {
          allowDestructive: options?.allowDestructive,
        });
      const outcome = await coordinator.enqueueSave(storyId, stateToSave, sendPut, {
        epoch: options?.epoch,
      });

      if (outcome.status === "saved") {
        return applySavedStoryOutcome({
          storyId,
          version: outcome.version,
          ackedSnapshotUpdatedAt: outcome.ackedSnapshotUpdatedAt,
          updatedAt: outcome.updatedAt,
          latestStateRef,
          dirtyStoryIdsRef,
          onClearLoadError,
          setDestructivePrompt,
          setSaveStatus,
        });
      }

      if (outcome.status === "destructive_rejected") {
        if (latestStateRef.current.ownerStoryId === storyId) {
          setSaveStatus("error");
          setDestructivePrompt({
            storyId,
            previousChars: outcome.previousChars,
            nextChars: outcome.nextChars,
            pendingState: stateToSave,
            reason: "destructive_drop",
          });
        }
        return false;
      }

      if (outcome.status === "rate_limited") {
        if (latestStateRef.current.ownerStoryId === storyId) {
          setSaveStatus("unsaved");
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (latestStateRef.current.ownerStoryId === storyId) {
              void executeCoordinatorSave(storyId, latestStateRef.current.state, {
                epoch: coordinator.getEpoch(storyId),
              });
            }
          }, outcome.retryAfterMs);
        }
        return false;
      }

      const presentation = resolveSaveFailurePresentation(outcome, Boolean(options?.isManual));
      if (presentation.shouldTrimPayloadAndRetry && !options?.isRetryAfterTrim) {
        const trimResult = await tryTrimPayloadAndRetry({
          storyId,
          stateToSave,
          isManual: options?.isManual,
          coordinator,
          latestStateRef,
          setStoryState,
          executeSave: executeCoordinatorSave,
          t,
        });
        if (trimResult.retried) return trimResult.saved;
      }

      if (outcome.status === "conflict" && presentation.shouldRunConflictRecovery) {
        return runStoryConflictRecovery({
          storyId,
          unsavedState: outcome.unsavedState,
          isManual: options?.isManual,
          coordinator,
          latestStateRef,
          dirtyStoryIdsRef,
          setStoryState,
          setSaveStatus,
          cancelPendingSaveTimers,
          executeSave: executeCoordinatorSave,
          t,
        });
      }

      if (latestStateRef.current.ownerStoryId === storyId) {
        setSaveStatus(presentation.nextSaveStatus);
      }
      if (presentation.shouldShowErrorToast && outcome.status !== "payload_too_large") {
        toast.error(t("novelcrafterSaveError"));
      }
      return false;
    },
    [
      isAuthed,
      latestStateRef,
      onClearLoadError,
      setSaveStatus,
      coordinator,
      setStoryState,
      cancelPendingSaveTimers,
      t,
    ]
  );

  const { confirmDestructiveSave, reloadAfterDestructiveRejection, retryLockedStory } =
    useStoryRecoveryActions({
      destructivePrompt,
      setDestructivePrompt,
      coordinator,
      latestStateRef,
      dirtyStoryIdsRef,
      isRetryingLockedStoryRef,
      onClearLoadError,
      setStoryState,
      setSaveStatus,
      executeCoordinatorSave,
      t,
    });

  const { scheduleSave, saveNow } = useStorySaveTriggers({
    isAuthed,
    validStoryId,
    coordinator,
    latestStateRef,
    loadErrorStoryIdRef,
    dirtyStoryIdsRef,
    saveTimerRef,
    draftThrottleTimerRef,
    setSaveStatus,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    ensureActiveStory,
    executeCoordinatorSave,
    retryLockedStory,
  });

  useStoryLifecycleListeners({
    latestStateRef,
    loadErrorStoryIdRef,
    dirtyStoryIdsRef,
    coordinator,
    flushLocalDraftSync,
    cancelPendingSaveTimers,
    executeCoordinatorSave,
    saveNow,
  });

  return {
    scheduleSave,
    saveNow,
    executeCoordinatorSave,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    dirtyStoryIdsRef,
    destructivePrompt,
    confirmDestructiveSave,
    reloadAfterDestructiveRejection,
  };
}
