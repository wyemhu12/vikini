// /app/features/novelcrafter/hooks/useStoryHydrationEffect.ts
"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { FrontendConversation } from "../../chat/hooks/useConversation";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import type { TranslationKey } from "@/lib/utils/translations";
import {
  hasUnsavedDraftContent,
  promoteUnsavedDraftToStory,
  readLocalStoryDraft,
  resolveStoryLoadFailureState,
  shouldBlockAutosaveForStory,
} from "@/lib/features/novelcrafter/draftStorage";
import {
  shouldApplyRemoteStoryLoad,
  type NovelcrafterSyncCoordinator,
  type StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import {
  createDefaultStoryState,
  type NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import { loadAndReconcileStoryState } from "./useNovelcrafterCatalog";

const hydrationLogger = logger.withContext("useStoryHydrationEffect");

export interface UseStoryHydrationEffectOptions {
  isAuthed: boolean;
  stories: ReadonlyArray<FrontendConversation>;
  storiesRef: MutableRefObject<FrontendConversation[]>;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  validStoryId: string | null;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  loadErrorStoryIdRef: MutableRefObject<string | null>;
  dirtyStoryIdsRef: MutableRefObject<Set<string>>;
  cancelPendingSaveTimers: () => void;
  flushLocalDraftSync: (storyId: string | null, state: NovelcrafterStoryState) => void;
  executeCoordinatorSave: (
    storyId: string,
    state: NovelcrafterStoryState,
    opts?: { epoch?: number }
  ) => Promise<boolean>;
  updateLoadErrorStoryId: (id: string | null) => void;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setIsLoadingState: Dispatch<SetStateAction<boolean>>;
  setHydratedStoryId: Dispatch<SetStateAction<string | null | undefined>>;
  setPromotedDraftStoryId: Dispatch<SetStateAction<string | null>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  loadRetryNonce: number;
  t: (key: TranslationKey) => string;
}

export function useStoryHydrationEffect({
  isAuthed,
  stories,
  storiesRef,
  selectedConversationId,
  setSelectedConversationId,
  validStoryId,
  coordinator,
  latestStateRef,
  loadErrorStoryIdRef,
  dirtyStoryIdsRef,
  cancelPendingSaveTimers,
  flushLocalDraftSync,
  executeCoordinatorSave,
  updateLoadErrorStoryId,
  setStoryState,
  setIsLoadingState,
  setHydratedStoryId,
  setPromotedDraftStoryId,
  setSaveStatus,
  loadRetryNonce,
  t,
}: UseStoryHydrationEffectOptions) {
  useEffect(() => {
    if (coordinator.isCreatingStory()) return;
    const hasUnsaved =
      latestStateRef.current.ownerStoryId === null &&
      hasUnsavedDraftContent(latestStateRef.current.state);
    if (!selectedConversationId && stories.length > 0 && !hasUnsaved) {
      setSelectedConversationId(stories[0].id);
    } else if (
      selectedConversationId &&
      stories.length > 0 &&
      !stories.some((s) => s.id === selectedConversationId)
    ) {
      setSelectedConversationId(stories[0].id);
    }
  }, [selectedConversationId, stories, setSelectedConversationId, coordinator, latestStateRef]);

  const prevValidStoryIdRef = useRef<string | null>(validStoryId);

  useEffect(() => {
    const prevStoryId = prevValidStoryIdRef.current;
    prevValidStoryIdRef.current = validStoryId;

    if (prevStoryId && prevStoryId !== validStoryId) {
      cancelPendingSaveTimers();
      const prevExists = storiesRef.current.some((s) => s.id === prevStoryId);
      if (
        prevExists &&
        dirtyStoryIdsRef.current.has(prevStoryId) &&
        latestStateRef.current.ownerStoryId === prevStoryId &&
        !shouldBlockAutosaveForStory(prevStoryId, loadErrorStoryIdRef.current)
      ) {
        const snapshot = latestStateRef.current.state;
        flushLocalDraftSync(prevStoryId, snapshot);
        void executeCoordinatorSave(prevStoryId, snapshot, {
          epoch: coordinator.getEpoch(prevStoryId),
        });
      }
    }

    if (!isAuthed || !validStoryId) {
      updateLoadErrorStoryId(null);
      if (!coordinator.isCreatingStory() && latestStateRef.current.ownerStoryId !== null) {
        cancelPendingSaveTimers();
        const fresh = createDefaultStoryState(t("novelcrafterDefaultChapterTitle"));
        latestStateRef.current = { ownerStoryId: null, state: fresh };
        setStoryState(fresh);
        setSaveStatus("saved");
      } else if (latestStateRef.current.ownerStoryId === null) {
        const unsavedEnv = readLocalStoryDraft(null, t("novelcrafterDefaultChapterTitle"));
        if (unsavedEnv?.dirty) {
          latestStateRef.current = { ownerStoryId: null, state: unsavedEnv.state };
          setStoryState(unsavedEnv.state);
        }
      }
      setHydratedStoryId(null);
      return;
    }

    const decision = shouldApplyRemoteStoryLoad({
      storyId: validStoryId,
      coordinator,
      currentOwnerStoryId: latestStateRef.current.ownerStoryId,
    });
    if (decision.shouldPromoteUnsaved) {
      updateLoadErrorStoryId(null);
      const promoted = promoteUnsavedDraftToStory(
        validStoryId,
        latestStateRef.current.state,
        coordinator,
        { markSkipNextGet: false }
      );
      latestStateRef.current = { ownerStoryId: validStoryId, state: promoted };
      setStoryState(promoted);
      setPromotedDraftStoryId(validStoryId);
      setHydratedStoryId(validStoryId);
      void executeCoordinatorSave(validStoryId, promoted, {
        epoch: coordinator.getEpoch(validStoryId),
      });
      return;
    }
    if (!decision.shouldFetch) {
      latestStateRef.current = { ownerStoryId: validStoryId, state: latestStateRef.current.state };
      setHydratedStoryId(validStoryId);
      return;
    }

    let cancelled = false;
    setIsLoadingState(true);
    void loadAndReconcileStoryState({
      convId: validStoryId,
      defaultChapterTitle: t("novelcrafterDefaultChapterTitle"),
      loadErrorMsg: t("novelcrafterLoadError"),
      coordinator,
    })
      .then((reconciled) => {
        if (cancelled) return;
        updateLoadErrorStoryId(null);
        latestStateRef.current = { ownerStoryId: validStoryId, state: reconciled.state };
        setStoryState(reconciled.state);
        setHydratedStoryId(validStoryId);
        if (reconciled.conflictDetected) toast.info(t("novelcrafterConflictBackupNotice"));
        if (reconciled.shouldSyncDraftToServer) {
          dirtyStoryIdsRef.current.add(validStoryId);
          void executeCoordinatorSave(validStoryId, reconciled.state, {
            epoch: coordinator.getEpoch(validStoryId),
          });
        } else {
          dirtyStoryIdsRef.current.delete(validStoryId);
          setSaveStatus("saved");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          cancelPendingSaveTimers();
          dirtyStoryIdsRef.current.delete(validStoryId);
          const fallbackScoped = resolveStoryLoadFailureState({
            storyId: validStoryId,
            defaultChapterTitle: t("novelcrafterDefaultChapterTitle"),
          });
          latestStateRef.current = fallbackScoped;
          setStoryState(fallbackScoped.state);
          setHydratedStoryId(validStoryId);
          updateLoadErrorStoryId(validStoryId);
          setSaveStatus("error");
          hydrationLogger.error("Failed to load story state:", err);
          toast.error(t("novelcrafterLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingState(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isAuthed,
    validStoryId,
    coordinator,
    storiesRef,
    latestStateRef,
    loadErrorStoryIdRef,
    dirtyStoryIdsRef,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    executeCoordinatorSave,
    updateLoadErrorStoryId,
    setStoryState,
    setIsLoadingState,
    setHydratedStoryId,
    setPromotedDraftStoryId,
    setSaveStatus,
    loadRetryNonce,
    t,
  ]);
}
