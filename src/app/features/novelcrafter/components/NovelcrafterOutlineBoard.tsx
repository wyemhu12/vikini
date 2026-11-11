// /app/features/novelcrafter/components/NovelcrafterOutlineBoard.tsx
"use client";

import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import {
  type ChapterOutlineStatus,
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
  onOpenChapter: (chapterId: string) => void;
  onAddChapter: () => void;
}

/** Outline view: every chapter as a card with status, summary and progress (phase 5B). */
export default function NovelcrafterOutlineBoard({
  chapters,
  activeChapterId,
  onOpenChapter,
  onAddChapter,
}: NovelcrafterOutlineBoardProps) {
  const { t, language } = useLanguage();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const totals = summarizeStoryOutline(chapters);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--faint)">
          {t("novelcrafterOutlineStats")
            .replace("{chapters}", totals.chapterCount.toLocaleString(locale))
            .replace("{words}", totals.wordCount.toLocaleString(locale))}
        </p>
        <button
          type="button"
          onClick={onAddChapter}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--line) px-3 text-sm font-medium text-(--text) transition-colors hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("novelcrafterAddChapter")}
        </button>
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {chapters.map((chapter, index) => {
          const info = summarizeChapterForOutline(chapter);
          const active = chapter.id === activeChapterId;
          const summary = chapter.summary?.trim();
          return (
            <li key={chapter.id} className="flex">
              <button
                type="button"
                onClick={() => onOpenChapter(chapter.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border bg-(--surface) p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
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
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs",
                      STATUS_CLASS[info.status]
                    )}
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
        })}
      </ol>
    </div>
  );
}
