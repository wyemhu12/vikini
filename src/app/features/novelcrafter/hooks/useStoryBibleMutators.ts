// /app/features/novelcrafter/hooks/useStoryBibleMutators.ts
"use client";

import { useCallback } from "react";
import { toast } from "@/lib/store/toastStore";
import { parseCharacterCardsFromMarkdown } from "@/lib/features/novelcrafter/characterParser";
import {
  MAX_CHARACTER_CARDS,
  MAX_OUTLINE_ITEMS,
  MAX_WORLD_ELEMENTS,
  type NovelcrafterStoryState,
  type StoryBible,
  type StoryBibleCharacterCard,
  type StoryBibleOutlineItem,
  type StoryBibleWorldElement,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";

type CommitStateChangeFn = (
  updater: (prev: NovelcrafterStoryState) => NovelcrafterStoryState,
  options?: { immediate?: boolean; skipSave?: boolean }
) => void;

export function useStoryBibleMutators(
  commitStateChange: CommitStateChangeFn,
  t: (key: TranslationKey) => string
) {
  const updateStoryBible = useCallback(
    (patch: Partial<StoryBible>) => {
      commitStateChange((prev) => ({
        ...prev,
        storyBible: { ...prev.storyBible, ...patch },
      }));
    },
    [commitStateChange]
  );

  const addCharacterCard = useCallback(() => {
    commitStateChange((prev) => {
      const current = prev.storyBible.characterCards || [];
      if (current.length >= MAX_CHARACTER_CARDS) return prev;
      const newCard: StoryBibleCharacterCard = {
        id: `char-${Date.now()}-${current.length + 1}`,
        name: `${t("novelcrafterBrainstormCharacters")} ${current.length + 1}`,
        role: "",
        traits: "",
        visibleToAI: true,
      };
      return {
        ...prev,
        storyBible: { ...prev.storyBible, characterCards: [...current, newCard] },
      };
    });
  }, [commitStateChange, t]);

  const updateCharacterCard = useCallback(
    (cardId: string, patch: Partial<Omit<StoryBibleCharacterCard, "id">>) => {
      commitStateChange((prev) => ({
        ...prev,
        storyBible: {
          ...prev.storyBible,
          characterCards: (prev.storyBible.characterCards || []).map((c) =>
            c.id === cardId ? { ...c, ...patch } : c
          ),
        },
      }));
    },
    [commitStateChange]
  );

  const deleteCharacterCard = useCallback(
    (cardId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          storyBible: {
            ...prev.storyBible,
            characterCards: (prev.storyBible.characterCards || []).filter((c) => c.id !== cardId),
          },
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const parseAndMergeCharacterCardsFromNotes = useCallback(() => {
    commitStateChange(
      (prev) => {
        const parsed = parseCharacterCardsFromMarkdown(prev.storyBible.characters);
        if (parsed.length === 0) return prev;
        const existing = prev.storyBible.characterCards || [];
        const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
        const additions = parsed.filter((p) => !existingNames.has(p.name.toLowerCase()));
        if (additions.length === 0) return prev;
        return {
          ...prev,
          storyBible: {
            ...prev.storyBible,
            characterCards: [...existing, ...additions].slice(0, MAX_CHARACTER_CARDS),
          },
        };
      },
      { immediate: true }
    );
  }, [commitStateChange]);

  const addWorldElement = useCallback(() => {
    commitStateChange((prev) => {
      const current = prev.storyBible.worldElements || [];
      if (current.length >= MAX_WORLD_ELEMENTS) return prev;
      const newElem: StoryBibleWorldElement = {
        id: `world-${Date.now()}-${current.length + 1}`,
        name: `${t("novelcrafterWorldbuildingLabel")} ${current.length + 1}`,
        category: "",
        description: "",
        visibleToAI: true,
      };
      return {
        ...prev,
        storyBible: { ...prev.storyBible, worldElements: [...current, newElem] },
      };
    });
  }, [commitStateChange, t]);

  const updateWorldElement = useCallback(
    (elementId: string, patch: Partial<Omit<StoryBibleWorldElement, "id">>) => {
      commitStateChange((prev) => ({
        ...prev,
        storyBible: {
          ...prev.storyBible,
          worldElements: (prev.storyBible.worldElements || []).map((w) =>
            w.id === elementId ? { ...w, ...patch } : w
          ),
        },
      }));
    },
    [commitStateChange]
  );

  const deleteWorldElement = useCallback(
    (elementId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          storyBible: {
            ...prev.storyBible,
            worldElements: (prev.storyBible.worldElements || []).filter((w) => w.id !== elementId),
          },
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const addOutlineItem = useCallback(
    (type: "act" | "chapter") => {
      commitStateChange((prev) => {
        const current = prev.storyBible.outlineItems || [];
        if (current.length >= MAX_OUTLINE_ITEMS) return prev;
        const newItem: StoryBibleOutlineItem = {
          id: `out-${Date.now()}-${current.length + 1}`,
          type,
          title:
            type === "act"
              ? `${t("novelcrafterOutlineActPrefix")} ${current.filter((i) => i.type === "act").length + 1}`
              : `${t("novelcrafterChapterPrefix")} ${current.filter((i) => i.type === "chapter").length + 1}`,
          summary: "",
        };
        return {
          ...prev,
          storyBible: { ...prev.storyBible, outlineItems: [...current, newItem] },
        };
      });
    },
    [commitStateChange, t]
  );

  const updateOutlineItem = useCallback(
    (itemId: string, patch: Partial<Omit<StoryBibleOutlineItem, "id">>) => {
      commitStateChange((prev) => ({
        ...prev,
        storyBible: {
          ...prev.storyBible,
          outlineItems: (prev.storyBible.outlineItems || []).map((o) =>
            o.id === itemId ? { ...o, ...patch } : o
          ),
        },
      }));
    },
    [commitStateChange]
  );

  const deleteOutlineItem = useCallback(
    (itemId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          storyBible: {
            ...prev.storyBible,
            outlineItems: (prev.storyBible.outlineItems || []).filter((o) => o.id !== itemId),
          },
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const sendOutlineItemToChapterScenes = useCallback(
    (itemId: string) => {
      commitStateChange(
        (prev) => {
          const item = (prev.storyBible.outlineItems || []).find((o) => o.id === itemId);
          if (!item || !item.summary.trim()) return prev;
          const targetChapterId = item.linkedChapterId || prev.activeChapterId;
          return {
            ...prev,
            chapters: prev.chapters.map((ch) =>
              ch.id === targetChapterId
                ? {
                    ...ch,
                    scenes: ch.scenes.trim()
                      ? `${ch.scenes.trim()}\n\n${item.summary.trim()}`
                      : item.summary.trim(),
                    updatedAt: Date.now(),
                  }
                : ch
            ),
          };
        },
        { immediate: true }
      );
      toast.success(t("novelcrafterSentToChapterScenesToast"));
    },
    [commitStateChange, t]
  );

  return {
    updateStoryBible,
    addCharacterCard,
    updateCharacterCard,
    deleteCharacterCard,
    parseAndMergeCharacterCardsFromNotes,
    addWorldElement,
    updateWorldElement,
    deleteWorldElement,
    addOutlineItem,
    updateOutlineItem,
    deleteOutlineItem,
    sendOutlineItemToChapterScenes,
  };
}
