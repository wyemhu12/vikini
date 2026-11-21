"use client";

import { useCallback, type MutableRefObject } from "react";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { createChapterSnapshot } from "@/lib/features/novelcrafter/draftStorage";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import {
  MAX_CHAPTERS,
  type NovelcrafterChapter,
  type NovelcrafterFeedbackItem,
  type NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";

type CommitStateChange = (
  updater: (prev: NovelcrafterStoryState) => NovelcrafterStoryState,
  options?: { immediate?: boolean; skipSave?: boolean }
) => void;

export function useChapterMutators(
  commitStateChange: CommitStateChange,
  latestStateRef: MutableRefObject<StoryScopedState>,
  t: (key: TranslationKey) => string
) {
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
        const prevAct = prev.chapters[prev.chapters.length - 1]?.actTitle?.trim();
        const newChapter: NovelcrafterChapter = {
          id: `ch-${Date.now()}-${nextIndex}`,
          title: `${t("novelcrafterChapterPrefix")} ${nextIndex}`,
          ...(prevAct ? { actTitle: prevAct } : {}),
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
          | "title"
          | "scenes"
          | "extraInstructions"
          | "content"
          | "feedbackItems"
          | "summary"
          | "snapshots"
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

  const createSnapshotForChapter = useCallback(
    (chapterId: string, label?: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.id === chapterId
              ? { ...ch, snapshots: createChapterSnapshot(ch, label), updatedAt: Date.now() }
              : ch
          ),
        }),
        { immediate: true }
      );
      toast.success(t("novelcrafterSnapshotCreatedToast"));
    },
    [commitStateChange, t]
  );

  const deleteChapterSnapshot = useCallback(
    (chapterId: string, snapshotId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) =>
            ch.id === chapterId
              ? {
                  ...ch,
                  snapshots: (ch.snapshots ?? []).filter((s) => s.id !== snapshotId),
                  updatedAt: Date.now(),
                }
              : ch
          ),
        }),
        { immediate: true }
      );
    },
    [commitStateChange]
  );

  const restoreChapterSnapshot = useCallback(
    (chapterId: string, snapshotId: string) => {
      commitStateChange(
        (prev) => ({
          ...prev,
          chapters: prev.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            const targetSnap = (ch.snapshots ?? []).find((s) => s.id === snapshotId);
            if (!targetSnap) return ch;
            const nextSnapshots =
              ch.content.trim().length > 0 && ch.content !== targetSnap.content
                ? createChapterSnapshot(ch, t("novelcrafterSnapshotAutoBackupLabel"))
                : ch.snapshots;
            return {
              ...ch,
              content: targetSnap.content,
              ...(nextSnapshots ? { snapshots: nextSnapshots } : {}),
              updatedAt: Date.now(),
            };
          }),
        }),
        { immediate: true }
      );
      toast.success(t("novelcrafterSnapshotRestoredToast"));
    },
    [commitStateChange, t]
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

  return {
    selectChapter,
    addChapter,
    updateChapter,
    createSnapshotForChapter,
    deleteChapterSnapshot,
    restoreChapterSnapshot,
    updateChapterFeedbackItems,
    deleteChapter,
  };
}
