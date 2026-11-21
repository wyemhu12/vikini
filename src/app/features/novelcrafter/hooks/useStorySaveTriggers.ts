"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  hasUnsavedDraftContent,
  LOCAL_DRAFT_THROTTLE_MS,
  shouldBlockAutosaveForStory,
} from "@/lib/features/novelcrafter/draftStorage";
import {
  SERVER_SYNC_DEBOUNCE_MS,
  type NovelcrafterSyncCoordinator,
  type StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { ExecuteCoordinatorSaveFn } from "../utils/storyRecoveryHelpers";

export interface UseStorySaveTriggersParams {
  isAuthed: boolean;
  validStoryId: string | null;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  loadErrorStoryIdRef: MutableRefObject<string | null>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  saveTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  draftThrottleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  cancelPendingSaveTimers: () => void;
  flushLocalDraftSync: (
    targetStoryId: string | null,
    stateToWrite: NovelcrafterStoryState
  ) => boolean;
  ensureActiveStory: (seedState?: NovelcrafterStoryState) => Promise<string | null>;
  executeCoordinatorSave: ExecuteCoordinatorSaveFn;
  retryLockedStory: (targetStoryId: string, currentState: NovelcrafterStoryState) => Promise<void>;
}

export function useStorySaveTriggers({
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
}: UseStorySaveTriggersParams) {
  const scheduleSave = useCallback(
    (nextState: NovelcrafterStoryState, options?: { immediate?: boolean }) => {
      const ownerId = latestStateRef.current.ownerStoryId;
      if (draftThrottleTimerRef.current) clearTimeout(draftThrottleTimerRef.current);
      draftThrottleTimerRef.current = setTimeout(() => {
        draftThrottleTimerRef.current = null;
        const quotaExceeded = flushLocalDraftSync(
          latestStateRef.current.ownerStoryId,
          latestStateRef.current.state
        );
        if (
          quotaExceeded &&
          latestStateRef.current.ownerStoryId &&
          !shouldBlockAutosaveForStory(
            latestStateRef.current.ownerStoryId,
            loadErrorStoryIdRef.current
          )
        ) {
          cancelPendingSaveTimers();
          void executeCoordinatorSave(
            latestStateRef.current.ownerStoryId,
            latestStateRef.current.state,
            { epoch: coordinator.getEpoch(latestStateRef.current.ownerStoryId) }
          );
        }
      }, LOCAL_DRAFT_THROTTLE_MS);

      if (!ownerId) {
        if (isAuthed && hasUnsavedDraftContent(nextState)) {
          flushLocalDraftSync(null, nextState);
          void ensureActiveStory(nextState);
        }
        return;
      }
      if (shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)) {
        return;
      }
      dirtyStoryIdsRef.current.add(ownerId);
      setSaveStatus("unsaved");
      cancelPendingSaveTimers();
      if (options?.immediate) {
        flushLocalDraftSync(ownerId, nextState);
        void executeCoordinatorSave(ownerId, nextState, { epoch: coordinator.getEpoch(ownerId) });
        return;
      }
      const scheduledEpoch = coordinator.getEpoch(ownerId);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (
          latestStateRef.current.ownerStoryId === ownerId &&
          !shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)
        ) {
          flushLocalDraftSync(ownerId, latestStateRef.current.state);
          void executeCoordinatorSave(ownerId, latestStateRef.current.state, {
            epoch: scheduledEpoch,
          });
        }
      }, SERVER_SYNC_DEBOUNCE_MS);
    },
    [
      latestStateRef,
      draftThrottleTimerRef,
      loadErrorStoryIdRef,
      dirtyStoryIdsRef,
      saveTimerRef,
      isAuthed,
      flushLocalDraftSync,
      ensureActiveStory,
      setSaveStatus,
      cancelPendingSaveTimers,
      coordinator,
      executeCoordinatorSave,
    ]
  );

  const saveNow = useCallback(
    async (options?: { isManual?: boolean }) => {
      const isManual = options?.isManual ?? true;
      cancelPendingSaveTimers();
      const currentOwnerId = latestStateRef.current.ownerStoryId;
      const currentState = latestStateRef.current.state;
      flushLocalDraftSync(currentOwnerId, currentState);
      const targetStoryId =
        currentOwnerId || validStoryId || (await ensureActiveStory(currentState));
      if (!targetStoryId) return;

      if (shouldBlockAutosaveForStory(targetStoryId, loadErrorStoryIdRef.current)) {
        await retryLockedStory(targetStoryId, currentState);
        return;
      }

      if (isManual) coordinator.resetConsecutiveRecoveries(targetStoryId);
      await executeCoordinatorSave(targetStoryId, latestStateRef.current.state, {
        epoch: coordinator.getEpoch(targetStoryId),
        isManual,
      });
    },
    [
      cancelPendingSaveTimers,
      latestStateRef,
      flushLocalDraftSync,
      validStoryId,
      ensureActiveStory,
      loadErrorStoryIdRef,
      retryLockedStory,
      coordinator,
      executeCoordinatorSave,
    ]
  );

  return { scheduleSave, saveNow };
}
