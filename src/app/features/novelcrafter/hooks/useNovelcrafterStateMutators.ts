// /app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts
"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import type { NovelcrafterSyncCoordinator } from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import {
  MAX_CHAPTERS,
  MAX_HISTORY_CARDS,
  type NovelcrafterChapter,
  type NovelcrafterFeatureSlot,
  type NovelcrafterFeedbackItem,
  type NovelcrafterHistoryCard,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { useStoryBibleMutators } from "./useStoryBibleMutators";

interface UseNovelcrafterStateMutatorsParams {
  latestStateRef: MutableRefObject<StoryScopedState>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  scheduleSave: (nextState: NovelcrafterStoryState, options?: { immediate?: boolean }) => void;
  coordinator?: NovelcrafterSyncCoordinator;
  t: (key: TranslationKey) => string;
}

export function useNovelcrafterStateMutators({
  latestStateRef,
  setStoryState,
  scheduleSave,
  coordinator,
  t,
}: UseNovelcrafterStateMutatorsParams) {
  const commitStateChange = useCallback(
    (
      updater: (prev: NovelcrafterStoryState) => NovelcrafterStoryState,
      options?: { immediate?: boolean; skipSave?: boolean }
    ) => {
      const ownerId = latestStateRef.current.ownerStoryId;
      const prev = latestStateRef.current.state;
      const updated = updater(prev);
      if (updated === prev) return;

      const confirmedVer =
        ownerId && coordinator ? coordinator.getConfirmedVersion(ownerId) : prev.version;
      const now = Date.now();
      const nextState: NovelcrafterStoryState = {
        ...updated,
        version: confirmedVer > 0 ? confirmedVer : prev.version,
        updatedAt: Math.max(now, prev.updatedAt + 1),
      };

      latestStateRef.current = {
        ownerStoryId: ownerId,
        state: nextState,
      };
      setStoryState(nextState);

      if (!options?.skipSave) {
        scheduleSave(nextState, { immediate: options?.immediate });
      }
    },
    [latestStateRef, setStoryState, scheduleSave, coordinator]
  );

  const applyDirectStoryState = useCallback(
    (nextState: NovelcrafterStoryState, options?: { immediate?: boolean; skipSave?: boolean }) => {
      latestStateRef.current = {
        ownerStoryId: latestStateRef.current.ownerStoryId,
        state: nextState,
      };
      setStoryState(nextState);
      if (!options?.skipSave) {
        scheduleSave(nextState, { immediate: options?.immediate });
      }
    },
    [latestStateRef, setStoryState, scheduleSave]
  );

  const bibleMutators = useStoryBibleMutators(commitStateChange, t);

  const updateRouting = useCallback(
    (patch: Partial<NovelcrafterRoutingConfig>) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          routing: {
            ...prev.routing,
            ...patch,
            featurePersonas: {
              ...prev.routing.featurePersonas,
              ...(patch.featurePersonas || {}),
            },
          },
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const updateFeaturePersonaSlot = useCallback(
    (slot: NovelcrafterFeatureSlot, value: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          routing: {
            ...prev.routing,
            featurePersonas: { ...prev.routing.featurePersonas, [slot]: value },
          },
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const setSelectedModel = useCallback(
    (modelId: string) => {
      commitStateChange((prev) => ({ ...prev, selectedModel: modelId }), { immediate: true });
    },
    [commitStateChange]
  );

  const setStoryBibleOpen = useCallback(
    (isOpen: boolean) => {
      commitStateChange((prev) => ({ ...prev, isStoryBibleOpen: isOpen }));
    },
    [commitStateChange]
  );

  const selectChapter = useCallback(
    (chapterId: string) => {
      commitStateChange((prev) => ({ ...prev, activeChapterId: chapterId }));
    },
    [commitStateChange]
  );

  const addChapter = useCallback(() => {
    commitStateChange(
      (prev) => {
        if (prev.chapters.length >= MAX_CHAPTERS) return prev;
        const nextIndex = prev.chapters.length + 1;
        const newChapter: NovelcrafterChapter = {
          id: `ch-${Date.now()}-${nextIndex}`,
          title: `${t("novelcrafterChapterPrefix")} ${nextIndex}`,
          scenes: "",
          extraInstructions: "",
          content: "",
          feedbackItems: [],
          updatedAt: Date.now(),
        };
        return {
          ...prev,
          activeChapterId: newChapter.id,
          chapters: [...prev.chapters, newChapter],
        };
      },
      { immediate: true }
    );
  }, [commitStateChange, t]);

  const updateChapter = useCallback(
    (
      chapterId: string,
      patch: Partial<
        Pick<
          NovelcrafterChapter,
          "title" | "scenes" | "extraInstructions" | "content" | "feedbackItems"
        >
      >
    ) => {
      commitStateChange((prev) => ({
        ...prev,
        chapters: prev.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, ...patch, updatedAt: Date.now() } : ch
        ),
      }));
    },
    [commitStateChange]
  );

  const updateChapterFeedbackItems = useCallback(
    (
      chapterId: string,
      updater: (items: NovelcrafterFeedbackItem[]) => NovelcrafterFeedbackItem[],
      immediate = false
    ) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, feedbackItems: updater(ch.feedbackItems ?? []), updatedAt: Date.now() }
              : ch
          ),
        }),
        { immediate }
      );
    },
    [commitStateChange]
  );

  const deleteChapter = useCallback(
    async (chapterId: string) => {
      if (latestStateRef.current.state.chapters.length <= 1) {
        toast.info(t("novelcrafterMinOneChapterToast"));
        return;
      }
      const confirmed = await confirm({
        title: t("novelcrafterDeleteChapterConfirmTitle"),
        description: t("novelcrafterDeleteChapterConfirmDesc"),
        variant: "danger",
      });
      if (!confirmed) return;

      commitStateChange(
        (prev) => {
          if (prev.chapters.length <= 1) return prev;
          const remaining = prev.chapters.filter((ch) => ch.id !== chapterId);
          const nextActive =
            prev.activeChapterId === chapterId ? remaining[0].id : prev.activeChapterId;
          return { ...prev, activeChapterId: nextActive, chapters: remaining };
        },
        { immediate: true }
      );
    },
    [latestStateRef, t, commitStateChange]
  );

  const prependHistoryCard = useCallback(
    (card: NovelcrafterHistoryCard) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          historyCards: [card, ...prev.historyCards].slice(0, MAX_HISTORY_CARDS),
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const deleteHistoryCard = useCallback(
    (cardId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          historyCards: prev.historyCards.filter((c) => c.id !== cardId),
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const clearHistoryCards = useCallback(async () => {
    const confirmed = await confirm({
      title: t("novelcrafterClearHistoryConfirmTitle"),
      description: t("novelcrafterClearHistoryConfirmDesc"),
      variant: "danger",
    });
    if (!confirmed) return;

    commitStateChange((prev) => ({ ...prev, historyCards: [] }), { immediate: true });
  }, [t, commitStateChange]);

  return {
    applyDirectStoryState,
    ...bibleMutators,
    updateRouting,
    updateFeaturePersonaSlot,
    setSelectedModel,
    setStoryBibleOpen,
    selectChapter,
    addChapter,
    updateChapter,
    updateChapterFeedbackItems,
    deleteChapter,
    prependHistoryCard,
    deleteHistoryCard,
    clearHistoryCards,
  };
}
