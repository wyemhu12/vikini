"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type {
  NovelcrafterSyncCoordinator,
  StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import {
  runLockedStoryRetry,
  runReloadAfterDestructiveRejection,
  type DestructiveSavePromptState,
  type ExecuteCoordinatorSaveFn,
} from "../utils/storyRecoveryHelpers";

export interface UseStoryRecoveryActionsParams {
  destructivePrompt: DestructiveSavePromptState | null;
  setDestructivePrompt: Dispatch<SetStateAction<DestructiveSavePromptState | null>>;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  isRetryingLockedStoryRef: MutableRefObject<string | null>;
  onClearLoadError?: (storyId: string) => void;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  executeCoordinatorSave: ExecuteCoordinatorSaveFn;
  t: (key: TranslationKey) => string;
}

export function useStoryRecoveryActions({
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
}: UseStoryRecoveryActionsParams) {
  const confirmDestructiveSave = useCallback(async () => {
    if (!destructivePrompt) return;
    const { storyId, pendingState } = destructivePrompt;
    setDestructivePrompt(null);
    await executeCoordinatorSave(storyId, pendingState, {
      epoch: coordinator.getEpoch(storyId),
      isManual: true,
      allowDestructive: true,
    });
  }, [destructivePrompt, setDestructivePrompt, executeCoordinatorSave, coordinator]);

  const reloadAfterDestructiveRejection = useCallback(async () => {
    await runReloadAfterDestructiveRejection({
      destructivePrompt,
      coordinator,
      latestStateRef,
      setDestructivePrompt,
      setStoryState,
      setSaveStatus,
      t,
    });
  }, [
    destructivePrompt,
    coordinator,
    latestStateRef,
    setDestructivePrompt,
    setStoryState,
    setSaveStatus,
    t,
  ]);

  const retryLockedStory = useCallback(
    async (targetStoryId: string, currentState: NovelcrafterStoryState) => {
      await runLockedStoryRetry({
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
        executeSave: executeCoordinatorSave,
        t,
      });
    },
    [
      coordinator,
      latestStateRef,
      dirtyStoryIdsRef,
      isRetryingLockedStoryRef,
      onClearLoadError,
      setStoryState,
      setSaveStatus,
      setDestructivePrompt,
      executeCoordinatorSave,
      t,
    ]
  );

  return {
    confirmDestructiveSave,
    reloadAfterDestructiveRejection,
    retryLockedStory,
  };
}
