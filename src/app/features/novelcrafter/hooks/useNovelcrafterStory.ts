// /app/features/novelcrafter/hooks/useNovelcrafterStory.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation, type FrontendConversation } from "../../chat/hooks/useConversation";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { MODEL_IDS } from "@/lib/utils/constants";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  hasUnsavedDraftContent,
  promoteUnsavedDraftToStory,
  readLocalStoryDraft,
  removeLocalStoryDraft,
  resolveValidNovelcrafterStoryId,
} from "@/lib/features/novelcrafter/draftStorage";
import {
  NovelcrafterSyncCoordinator,
  shouldApplyRemoteStoryLoad,
  type StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import {
  createDefaultStoryState,
  type NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import {
  loadAndReconcileStoryState,
  spawnAndBindStoryConversation,
  useNovelcrafterCatalog,
  type ClientGemItem,
  type ClientPersonaItem,
} from "./useNovelcrafterCatalog";
import { useNovelcrafterStateMutators } from "./useNovelcrafterStateMutators";
import { useStoryPersistenceLifecycle } from "./useStoryPersistenceLifecycle";

export type { ClientGemItem, ClientPersonaItem, StorySaveStatus };

const storyLogger = logger.withContext("useNovelcrafterStory");

export function useNovelcrafterStory(isAuthed: boolean) {
  const { t } = useLanguage();
  const { gems, personas } = useNovelcrafterCatalog(isAuthed);
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
    creatingConversation,
  } = useConversation();

  const coordinatorRef = useRef<NovelcrafterSyncCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new NovelcrafterSyncCoordinator();
  const coordinator = coordinatorRef.current;

  const stories = useMemo(
    () =>
      (conversations || []).filter((c: FrontendConversation) => c.model === MODEL_IDS.NOVELCRAFTER),
    [conversations]
  );

  const storiesRef = useRef(stories);
  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  const validStoryId = useMemo(
    () => resolveValidNovelcrafterStoryId(selectedConversationId, stories),
    [selectedConversationId, stories]
  );

  const currentStory = useMemo(
    () => (validStoryId ? stories.find((s) => s.id === validStoryId) || null : null),
    [stories, validStoryId]
  );

  const [storyState, setStoryState] = useState<NovelcrafterStoryState>(() =>
    createDefaultStoryState(t("novelcrafterDefaultChapterTitle"))
  );
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>("saved");

  const latestStateRef = useRef<StoryScopedState>({ ownerStoryId: null, state: storyState });
  const executeSaveRef = useRef<
    (storyId: string, state: NovelcrafterStoryState, opts?: { epoch?: number }) => Promise<boolean>
  >(async () => false);

  const ensureActiveStory = useCallback(
    async (seedState?: NovelcrafterStoryState): Promise<string | null> => {
      if (validStoryId) return validStoryId;
      const newId = await spawnAndBindStoryConversation({
        knownStoryIds: storiesRef.current.map((s) => s.id),
        stateToSeed: seedState ?? latestStateRef.current.state,
        promoteUnsaved: true,
        defaultStoryTitle: t("novelcrafterDefaultStoryTitle"),
        coordinator,
        latestStateRef,
        setStoryState,
        createConversation,
      });
      if (newId) {
        void executeSaveRef.current(newId, latestStateRef.current.state, {
          epoch: coordinator.getEpoch(newId),
        });
      }
      return newId;
    },
    [validStoryId, t, coordinator, createConversation]
  );

  const {
    scheduleSave,
    saveNow,
    executeCoordinatorSave,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    dirtyStoryIdsRef,
  } = useStoryPersistenceLifecycle({
    isAuthed,
    validStoryId,
    coordinator,
    latestStateRef,
    setStoryState,
    setSaveStatus,
    ensureActiveStory,
    t,
  });

  useEffect(() => {
    executeSaveRef.current = executeCoordinatorSave;
  }, [executeCoordinatorSave]);

  // Auto-select most recent story unless user is typing an unsaved draft or creating a story (M19b, m24)
  useEffect(() => {
    if (coordinator.isCreatingStory()) return;
    const hasActiveUnsavedDraft =
      latestStateRef.current.ownerStoryId === null &&
      hasUnsavedDraftContent(latestStateRef.current.state);

    if (!selectedConversationId && stories.length > 0 && !hasActiveUnsavedDraft) {
      setSelectedConversationId(stories[0].id);
    } else if (
      selectedConversationId &&
      stories.length > 0 &&
      !stories.some((s) => s.id === selectedConversationId)
    ) {
      setSelectedConversationId(stories[0].id);
    }
  }, [selectedConversationId, stories, setSelectedConversationId, coordinator]);

  const prevValidStoryIdRef = useRef<string | null>(validStoryId);

  // Load & reconcile story state when validStoryId changes (M19, m24, m26)
  useEffect(() => {
    const prevStoryId = prevValidStoryIdRef.current;
    prevValidStoryIdRef.current = validStoryId;

    if (prevStoryId && prevStoryId !== validStoryId) {
      cancelPendingSaveTimers();
      const prevStillExists = storiesRef.current.some((s) => s.id === prevStoryId);
      if (
        prevStillExists &&
        dirtyStoryIdsRef.current.has(prevStoryId) &&
        latestStateRef.current.ownerStoryId === prevStoryId
      ) {
        const snapshot = latestStateRef.current.state;
        flushLocalDraftSync(prevStoryId, snapshot);
        void executeCoordinatorSave(prevStoryId, snapshot, {
          epoch: coordinator.getEpoch(prevStoryId),
        });
      }
    }

    if (!isAuthed || !validStoryId) {
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
      return;
    }

    const decision = shouldApplyRemoteStoryLoad({
      storyId: validStoryId,
      coordinator,
      currentOwnerStoryId: latestStateRef.current.ownerStoryId,
    });

    if (decision.shouldPromoteUnsaved) {
      const promoted = promoteUnsavedDraftToStory(
        validStoryId,
        latestStateRef.current.state,
        coordinator,
        { markSkipNextGet: false }
      );
      latestStateRef.current = { ownerStoryId: validStoryId, state: promoted };
      setStoryState(promoted);
      void executeCoordinatorSave(validStoryId, promoted, {
        epoch: coordinator.getEpoch(validStoryId),
      });
      return;
    }

    if (!decision.shouldFetch) {
      latestStateRef.current = { ownerStoryId: validStoryId, state: latestStateRef.current.state };
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
        latestStateRef.current = { ownerStoryId: validStoryId, state: reconciled.state };
        setStoryState(reconciled.state);
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
          storyLogger.error("Failed to load story state:", err);
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
    cancelPendingSaveTimers,
    dirtyStoryIdsRef,
    flushLocalDraftSync,
    executeCoordinatorSave,
    t,
  ]);

  const handleCreateStory = useCallback(async (): Promise<string | null> => {
    try {
      const prevOwner = latestStateRef.current.ownerStoryId;
      if (prevOwner && dirtyStoryIdsRef.current.has(prevOwner)) {
        cancelPendingSaveTimers();
        flushLocalDraftSync(prevOwner, latestStateRef.current.state);
        void executeCoordinatorSave(prevOwner, latestStateRef.current.state, {
          epoch: coordinator.getEpoch(prevOwner),
        });
      }
      const initialState = createDefaultStoryState(t("novelcrafterDefaultChapterTitle"));
      const newId = await spawnAndBindStoryConversation({
        knownStoryIds: storiesRef.current.map((s) => s.id),
        stateToSeed: initialState,
        promoteUnsaved: false,
        defaultStoryTitle: t("novelcrafterDefaultStoryTitle"),
        coordinator,
        latestStateRef,
        setStoryState,
        createConversation,
      });
      if (!newId) throw new Error(t("novelcrafterCreateStoryError"));
      await executeCoordinatorSave(newId, initialState, { epoch: coordinator.getEpoch(newId) });
      return newId;
    } catch (err: unknown) {
      storyLogger.error("handleCreateStory failed:", err);
      toast.error(t("novelcrafterCreateStoryError"));
      return null;
    }
  }, [
    dirtyStoryIdsRef,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    executeCoordinatorSave,
    coordinator,
    t,
    createConversation,
  ]);

  const handleDeleteStory = useCallback(
    async (storyId: string) => {
      const confirmed = await confirm({
        title: t("novelcrafterDeleteStoryConfirmTitle"),
        description: t("novelcrafterDeleteStoryConfirmDesc"),
        variant: "danger",
      });
      if (!confirmed) return;
      try {
        if (latestStateRef.current.ownerStoryId === storyId) cancelPendingSaveTimers();
        dirtyStoryIdsRef.current.delete(storyId);
        removeLocalStoryDraft(storyId);
        await deleteConversation(storyId);
      } catch (err: unknown) {
        storyLogger.error("handleDeleteStory failed:", err);
        toast.error(t("deleteFailed"));
      }
    },
    [t, cancelPendingSaveTimers, dirtyStoryIdsRef, deleteConversation]
  );

  const handleRenameStory = useCallback(
    async (storyId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      try {
        await renameConversation(storyId, trimmed);
      } catch (err: unknown) {
        storyLogger.error("handleRenameStory failed:", err);
        toast.error(t("renameChatFailed"));
      }
    },
    [renameConversation, t]
  );

  const mutators = useNovelcrafterStateMutators({ latestStateRef, setStoryState, scheduleSave, t });

  const activeChapter = useMemo(
    () =>
      storyState.chapters.find((c) => c.id === storyState.activeChapterId) ||
      storyState.chapters[0],
    [storyState.chapters, storyState.activeChapterId]
  );

  const previousChapterProseTail = useMemo(() => {
    const idx = storyState.chapters.findIndex((c) => c.id === activeChapter?.id);
    return idx > 0 ? storyState.chapters[idx - 1]?.content?.slice(-2000) || "" : "";
  }, [storyState.chapters, activeChapter]);

  return {
    stories,
    currentStory,
    validStoryId,
    selectedConversationId,
    setSelectedConversationId,
    creatingConversation,
    storyState,
    latestStateRef,
    activeChapter,
    previousChapterProseTail,
    isLoadingState,
    saveStatus,
    gems,
    personas,
    ensureActiveStory,
    saveNow,
    handleCreateStory,
    handleDeleteStory,
    handleRenameStory,
    ...mutators,
  };
}
