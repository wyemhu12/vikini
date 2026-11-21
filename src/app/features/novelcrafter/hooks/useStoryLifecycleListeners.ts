"use client";

import { useEffect, type MutableRefObject } from "react";
import { shouldBlockAutosaveForStory } from "@/lib/features/novelcrafter/draftStorage";
import type { NovelcrafterSyncCoordinator } from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { ExecuteCoordinatorSaveFn } from "../utils/storyRecoveryHelpers";

export interface UseStoryLifecycleListenersParams {
  latestStateRef: MutableRefObject<StoryScopedState>;
  loadErrorStoryIdRef: MutableRefObject<string | null>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  coordinator: NovelcrafterSyncCoordinator;
  flushLocalDraftSync: (
    targetStoryId: string | null,
    stateToWrite: NovelcrafterStoryState
  ) => boolean;
  cancelPendingSaveTimers: () => void;
  executeCoordinatorSave: ExecuteCoordinatorSaveFn;
  saveNow: (options?: { isManual?: boolean }) => Promise<void>;
}

export function useStoryLifecycleListeners({
  latestStateRef,
  loadErrorStoryIdRef,
  dirtyStoryIdsRef,
  coordinator,
  flushLocalDraftSync,
  cancelPendingSaveTimers,
  executeCoordinatorSave,
  saveNow,
}: UseStoryLifecycleListenersParams) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const ownerId = latestStateRef.current.ownerStoryId;
      const currentState = latestStateRef.current.state;
      flushLocalDraftSync(ownerId, currentState);
      if (
        ownerId &&
        dirtyStoryIdsRef.current.has(ownerId) &&
        !shouldBlockAutosaveForStory(ownerId, loadErrorStoryIdRef.current)
      ) {
        cancelPendingSaveTimers();
        void executeCoordinatorSave(ownerId, currentState, {
          epoch: coordinator.getEpoch(ownerId),
        });
      }
    };
    const handlePageHide = () =>
      flushLocalDraftSync(latestStateRef.current.ownerStoryId, latestStateRef.current.state);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow({ isManual: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    latestStateRef,
    loadErrorStoryIdRef,
    dirtyStoryIdsRef,
    flushLocalDraftSync,
    cancelPendingSaveTimers,
    coordinator,
    executeCoordinatorSave,
    saveNow,
  ]);
}
