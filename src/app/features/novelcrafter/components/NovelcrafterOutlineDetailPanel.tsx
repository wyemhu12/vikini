// /app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.tsx
"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Sparkles, Square, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  appendSceneBeat,
  parseSceneBeats,
  removeSceneBeatAt,
  resolveChapterOutlineContextChips,
  updateSceneBeatAt,
  type OutlineContextChip,
} from "@/lib/features/novelcrafter/chapterOutline";
import type { NovelcrafterChapter, StoryBible } from "@/lib/features/novelcrafter/types";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";

export interface NovelcrafterOutlineDetailPanelProps {
  chapter: NovelcrafterChapter;
  chapterIndex: number;
  storyBible: StoryBible;
  isStreaming: boolean;
  onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void> | void;
  onStopStream: () => void;
  onOpenChapter: (chapterId: string) => void;
  onClose: () => void;
  isInSheet?: boolean;
}

/** Right chapter detail panel for the Outline view matching NovelOutline.dc.html (phase 5E). */
export default function NovelcrafterOutlineDetailPanel({
  chapter,
  chapterIndex,
  storyBible,
  isStreaming,
  onUpdateChapter,
  onTriggerStream,
  onStopStream,
  onOpenChapter,
  onClose,
  isInSheet = false,
}: NovelcrafterOutlineDetailPanelProps) {
  const { t } = useLanguage();
  const summaryId = useId();
  const actInputId = useId();

  const [titleDraft, setTitleDraft] = useState(chapter.title);
  useEffect(() => setTitleDraft(chapter.title), [chapter.id, chapter.title]);

  const beats = useMemo(() => parseSceneBeats(chapter.scenes), [chapter.scenes]);
  const contextChips = useMemo(
    () => resolveChapterOutlineContextChips(chapter, chapterIndex, storyBible),
    [chapter, chapterIndex, storyBible]
  );

  const chapterNumber = chapterIndex + 1;
  const headerMeta = chapter.actTitle?.trim()
    ? `${t("novelcrafterChapterPrefix")} ${chapterNumber} · ${chapter.actTitle.trim()}`
    : `${t("novelcrafterChapterPrefix")} ${chapterNumber}`;

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(chapter.title);
      return;
    }
    if (trimmed !== chapter.title) {
      onUpdateChapter(chapter.id, { title: trimmed });
    }
  };

  const renderChipLabel = (chip: OutlineContextChip): string => {
    if (chip.kind === "synopsis") return t("novelcrafterSynopsisLabel");
    if (chip.kind === "style") return t("novelcrafterStyleLabel");
    if (chip.kind === "genre") return t("novelcrafterGenreLabel");
    if (chip.kind === "previous_chapters") {
      return t("novelcrafterOutlineContextPrevChapters").replace(
        "{count}",
        String(chip.count ?? 0)
      );
    }
    if (chip.label) return chip.label;
    return t("novelcrafterWorldbuildingLabel");
  };

  return (
    <aside
      aria-label={t("novelcrafterOutlineDetailAria").replace("{number}", String(chapterNumber))}
      className={cn(
        "w-full lg:w-[380px] shrink-0 bg-(--surface) flex flex-col min-h-0 h-full",
        !isInSheet && "border-l border-(--line)"
      )}
    >
      <div
        className={cn(
          "px-5 pt-4 pb-3.5 border-b border-(--line) flex flex-col gap-2 shrink-0",
          isInSheet && "pr-11"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-(--faint) truncate">{headerMeta}</span>
          {!isInSheet && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("novelcrafterOutlineCloseDetail")}
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-(--faint) hover:text-(--text) hover:bg-(--raised) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label={t("novelcrafterRenameChapter")}
          className="w-full bg-transparent font-serif text-[24px] leading-tight text-(--text) border-b border-transparent hover:border-(--line) focus:border-(--accent) focus:outline-none pb-0.5"
        />

        <div className="flex items-center gap-2 pt-0.5">
          <label htmlFor={actInputId} className="text-xs font-medium text-(--faint) shrink-0">
            {t("novelcrafterChapterActLabel")}
          </label>
          <input
            id={actInputId}
            type="text"
            value={chapter.actTitle ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onUpdateChapter(chapter.id, { actTitle: raw.trim() ? raw : undefined });
            }}
            placeholder={t("novelcrafterChapterActPlaceholder")}
            className="flex-1 min-w-0 h-7 rounded-lg border border-(--line) bg-(--bg) px-2 text-xs text-(--text) placeholder:text-(--faint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={summaryId} className="text-xs font-semibold text-(--text)">
            {t("novelcrafterChapterSummaryLabel")}
          </label>
          <textarea
            id={summaryId}
            rows={3}
            value={chapter.summary ?? ""}
            onChange={(e) => onUpdateChapter(chapter.id, { summary: e.target.value })}
            placeholder={t("novelcrafterChapterSummaryPlaceholder")}
            className="w-full resize-none rounded-xl border border-(--line) bg-(--bg) px-3 py-2 text-sm leading-relaxed text-(--text) placeholder:text-(--faint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-(--text)">
              {t("novelcrafterChapterBeatsLabel")}
            </span>
            <button
              type="button"
              disabled={isStreaming}
              onClick={() => {
                if (isStreaming) return;
                void onTriggerStream({
                  feature: "bible",
                  bibleTarget: "scenes",
                  actionMode: beats.length > 0 ? "rewrite" : "generate",
                  subLabel: t("novelcrafterOutlineEditWithAi"),
                });
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-(--accent) hover:bg-(--soft) disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{t("novelcrafterOutlineEditWithAi")}</span>
            </button>
          </div>

          <ol className="flex flex-col gap-1.5">
            {beats.map((beat, idx) => (
              <li
                key={`${chapter.id}-beat-${idx}`}
                className="flex items-start gap-2 rounded-xl border border-(--line) bg-(--bg) px-2.5 py-2"
              >
                <span aria-hidden="true" className="mt-1 font-mono text-xs text-(--faint)">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={beat}
                  aria-label={t("novelcrafterOutlineBeatInputAria").replace(
                    "{number}",
                    String(idx + 1)
                  )}
                  onChange={(e) =>
                    onUpdateChapter(chapter.id, {
                      scenes: updateSceneBeatAt(chapter.scenes, idx, e.target.value),
                    })
                  }
                  className="flex-1 min-w-0 bg-transparent text-sm text-(--text) focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={t("novelcrafterOutlineRemoveBeatAria").replace(
                    "{number}",
                    String(idx + 1)
                  )}
                  onClick={() =>
                    onUpdateChapter(chapter.id, {
                      scenes: removeSceneBeatAt(chapter.scenes, idx),
                    })
                  }
                  className="p-1 rounded-md text-(--faint) hover:text-(--danger) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}

            <li>
              <button
                type="button"
                onClick={() =>
                  onUpdateChapter(chapter.id, {
                    scenes: appendSceneBeat(chapter.scenes, t("novelcrafterOutlineDefaultNewBeat")),
                  })
                }
                className="w-full h-9 rounded-xl border border-dashed border-(--line) bg-transparent text-xs font-medium text-(--faint) hover:border-(--accent) hover:text-(--text) inline-flex items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <span>{t("novelcrafterOutlineAddBeat")}</span>
              </button>
            </li>
          </ol>
        </div>

        <div className="rounded-xl bg-(--raised) p-3 flex flex-col gap-2">
          <span className="text-xs font-semibold text-(--text)">
            {t("novelcrafterOutlineAiContextTitle")}
          </span>
          {contextChips.length === 0 ? (
            <span className="text-xs text-(--faint)">{t("novelcrafterOutlineAiContextEmpty")}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {contextChips.map((chip) => (
                <span
                  key={chip.id}
                  className="rounded-md border border-(--line) bg-(--surface) px-2 py-0.5 text-xs text-(--muted)"
                >
                  {renderChipLabel(chip)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-(--line) px-5 pt-3.5 pb-4 flex flex-col gap-2">
        {isStreaming ? (
          <button
            type="button"
            onClick={onStopStream}
            className="h-11 rounded-xl bg-(--accent) text-(--on-accent) text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            <span>{t("stopBtn")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "draft",
                actionMode: chapter.content.trim() ? "rewrite" : "generate",
                subLabel: t("novelcrafterOutlineWriteDraftCta"),
              })
            }
            className="h-11 rounded-xl bg-(--accent) text-(--on-accent) text-sm font-semibold transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {t("novelcrafterOutlineWriteDraftCta")}
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenChapter(chapter.id)}
          className="h-9 rounded-xl border border-(--line) bg-transparent text-xs font-medium text-(--text) hover:bg-(--raised) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {t("novelcrafterOutlineOpenInWriteBtn")}
        </button>

        <p className="text-center text-xs text-(--faint)">{t("novelcrafterOutlineDraftHint")}</p>
      </div>
    </aside>
  );
}
