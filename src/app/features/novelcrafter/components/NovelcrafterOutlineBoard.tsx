// /app/features/novelcrafter/components/NovelcrafterOutlineBoard.tsx
"use client";

import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import {
  type ChapterOutlineStatus,
  countStoryActs,
  groupChaptersByAct,
  summarizeChapterForOutline,
  summarizeStoryOutline,
} from "@/lib/features/novelcrafter/chapterOutline";
import { useLanguage } from "../../chat/hooks/useLanguage";

const STATUS_KEY: Record<ChapterOutlineStatus, TranslationKey> = {
  idea: "novelcrafterOutlineStatusIdea",
  planned: "novelcrafterOutlineStatusPlanned",
  draft: "novelcrafterOutlineStatusDraft",
};

const STATUS_CLASS: Record<ChapterOutlineStatus, string> = {
  idea: "border border-(--line) text-(--faint)",
  planned: "bg-(--raised) text-(--muted)",
  draft: "bg-(--soft) text-(--accent)",
};

interface NovelcrafterOutlineBoardProps {
  chapters: readonly NovelcrafterChapter[];
  activeChapterId: string;
  selectedChapterId?: string;
  onSelectChapter?: (chapterId: string) => void;
  onOpenChapter: (chapterId: string) => void;
  onAddChapter: () => void;
}

/** Outline view: chapter cards grouped by act (when defined) with status & progress (phase 5B/5E). */
export default function NovelcrafterOutlineBoard({
  chapters,
  activeChapterId,
  selectedChapterId,
  onSelectChapter,
  onOpenChapter,
  onAddChapter,
}: NovelcrafterOutlineBoardProps) {
  const { t, language } = useLanguage();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const totals = summarizeStoryOutline(chapters);
  const actCount = countStoryActs(chapters);
  const currentId = selectedChapterId ?? activeChapterId;

  const statsLabel =
    actCount > 0
      ? t("novelcrafterOutlineStatsWithActs")
          .replace("{acts}", actCount.toLocaleString(locale))
          .replace("{chapters}", totals.chapterCount.toLocaleString(locale))
          .replace("{words}", totals.wordCount.toLocaleString(locale))
      : t("novelcrafterOutlineStats")
          .replace("{chapters}", totals.chapterCount.toLocaleString(locale))
          .replace("{words}", totals.wordCount.toLocaleString(locale));

  const renderCard = (chapter: NovelcrafterChapter, index: number) => {
    const info = summarizeChapterForOutline(chapter);
    const active = chapter.id === currentId;
    const summary = chapter.summary?.trim();

    return (
      <li key={chapter.id} className="flex">
        <button
          type="button"
          onClick={() =>
            onSelectChapter ? onSelectChapter(chapter.id) : onOpenChapter(chapter.id)
          }
          onDoubleClick={() => onOpenChapter(chapter.id)}
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex w-full flex-col gap-2 rounded-xl border bg-(--surface) p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
            active ? "border-(--accent)" : "border-(--line) hover:border-(--accent)"
          )}
        >
          <span className="flex w-full items-center gap-2">
            <span className="font-mono text-xs text-(--faint)">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-(--text)">
              {chapter.title}
            </span>
            <span
              className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", STATUS_CLASS[info.status])}
            >
              {t(STATUS_KEY[info.status])}
            </span>
          </span>
          <span className="line-clamp-3 text-sm leading-relaxed text-(--muted)">
            {summary || t("novelcrafterOutlineNoSummary")}
          </span>
          <span className="mt-auto text-xs text-(--faint)">
            {t("novelcrafterOutlineChapterMeta")
              .replace("{scenes}", info.sceneCount.toLocaleString(locale))
              .replace("{words}", info.wordCount.toLocaleString(locale))}
          </span>
        </button>
      </li>
    );
  };

  const actGroups = actCount > 0 ? groupChaptersByAct(chapters) : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--faint)">{statsLabel}</p>
        <button
          type="button"
          onClick={onAddChapter}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) px-3 text-sm font-medium text-(--text) transition-colors hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("novelcrafterAddChapter")}
        </button>
      </div>

      {actGroups ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {actGroups.map((group) => {
            const groupLabel = group.actTitle || t("novelcrafterOutlineUnassignedAct");
            const groupStats = t("novelcrafterOutlineStats")
              .replace("{chapters}", group.chapterCount.toLocaleString(locale))
              .replace("{words}", group.wordCount.toLocaleString(locale));
            return (
              <section
                key={group.key}
                aria-label={groupLabel}
                className="flex flex-col gap-2.5 min-w-0"
              >
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h2 className="text-sm font-semibold text-(--text) truncate">{groupLabel}</h2>
                  <span className="text-xs text-(--faint) shrink-0">{groupStats}</span>
                </div>
                <ol className="flex flex-col gap-2.5">
                  {group.chapters.map(({ chapter, index }) => renderCard(chapter, index))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : (
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {chapters.map((chapter, index) => renderCard(chapter, index))}
        </ol>
      )}
    </div>
  );
}
