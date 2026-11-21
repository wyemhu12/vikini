// /app/features/novelcrafter/hooks/useNovelcrafterStateMutators.ts
"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { confirm } from "@/lib/store/confirmStore";
import type { NovelcrafterSyncCoordinator } from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import {
  MAX_HISTORY_CARDS,
  type NovelcrafterFeatureModels,
  type NovelcrafterFeatureSlot,
  type NovelcrafterHistoryCard,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { useStoryBibleMutators } from "./useStoryBibleMutators";
import { useChapterMutators } from "./useChapterMutators";

const INHERIT_SLOTS: NovelcrafterFeatureModels = {
  bible: "inherit",
  write: "inherit",
  rewrite: "inherit",
  feedback: "inherit",
  expand: "inherit",
  brainstorm: "inherit",
};

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

      latestStateRef.current = { ownerStoryId: ownerId, state: nextState };
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
  const chapterMutators = useChapterMutators(commitStateChange, latestStateRef, t);

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
            ...(prev.routing.featureModels || patch.featureModels
              ? {
                  featureModels: {
                    ...INHERIT_SLOTS,
                    ...(prev.routing.featureModels || {}),
                    ...(patch.featureModels || {}),
                  },
                }
              : {}),
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

  const updateFeatureModelSlot = useCallback(
    (slot: NovelcrafterFeatureSlot, value: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          routing: {
            ...prev.routing,
            featureModels: {
              ...INHERIT_SLOTS,
              ...(prev.routing.featureModels || {}),
              [slot]: value,
            },
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
    ...chapterMutators,
    updateRouting,
    updateFeaturePersonaSlot,
    updateFeatureModelSlot,
    setSelectedModel,
    setStoryBibleOpen,
    prependHistoryCard,
    deleteHistoryCard,
    clearHistoryCards,
  };
}
