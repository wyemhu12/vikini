// /app/features/novelcrafter/components/ChapterDraftBeatsCard.tsx
"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { MAX_CHAPTER_SUMMARY_CHARS } from "@/lib/features/novelcrafter/types";
import { TRANSITION } from "@/lib/utils/motion";

interface ChapterDraftBeatsCardProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: string;
  onChangeScenes: (val: string) => void;
  extraInstructions: string;
  onChangeExtraInstructions: (val: string) => void;
  summary?: string;
  onChangeSummary?: (val: string) => void;
  onSummarizeChapter?: () => void;
  canSummarizeChapter?: boolean;
  isStreaming: boolean;
  onGenerateBeats: () => void;
  onRewriteBeats: () => void;
  onRunFirstDraft: () => void;
}

export default function ChapterDraftBeatsCard({
  isOpen,
  onClose,
  scenes,
  onChangeScenes,
  extraInstructions,
  onChangeExtraInstructions,
  summary = "",
  onChangeSummary,
  onSummarizeChapter,
  canSummarizeChapter = false,
  isStreaming,
  onGenerateBeats,
  onRewriteBeats,
  onRunFirstDraft,
}: ChapterDraftBeatsCardProps) {
  const { t } = useLanguage();

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.section
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={TRANSITION.FAST}
          className="px-6 md:px-12 lg:px-16 pb-4 overflow-hidden shrink-0"
        >
          <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl rounded-2xl border border-(--border) bg-(--surface)/85 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-(--text-secondary)">
                {t("novelcrafterChapterBeatsLabel")}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="p-1 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={4}
              value={scenes}
              onChange={(e) => onChangeScenes(e.target.value)}
              placeholder={t("novelcrafterChapterBeatsPlaceholder")}
              aria-label={t("novelcrafterChapterBeatsLabel")}
              className="w-full rounded-xl border border-(--border) bg-(--surface-elevated)/60 px-4 py-3 text-[14px] leading-[1.65] tracking-[-0.005em] text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
            />

            <input
              type="text"
              value={extraInstructions}
              onChange={(e) => onChangeExtraInstructions(e.target.value)}
              placeholder={t("novelcrafterExtraInstructionsPlaceholder")}
              aria-label={t("novelcrafterExtraInstructionsLabel")}
              className="w-full h-9 rounded-xl border border-(--border) bg-(--surface-elevated)/40 px-3.5 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            />

            <div className="pt-2 border-t border-(--border)/60 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-(--text-secondary)">
                    {t("novelcrafterChapterSummaryLabel")}
                  </span>
                  <span className="text-xs text-(--text-secondary)/80">
                    {summary.length}/{MAX_CHAPTER_SUMMARY_CHARS}
                  </span>
                </div>
                {onSummarizeChapter && (
                  <button
                    type="button"
                    disabled={isStreaming || !canSummarizeChapter}
                    onClick={onSummarizeChapter}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--accent) disabled:opacity-50"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>{t("novelcrafterSummarizeChapterBtn")}</span>
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                maxLength={MAX_CHAPTER_SUMMARY_CHARS}
                value={summary}
                onChange={(e) => onChangeSummary?.(e.target.value)}
                placeholder={t("novelcrafterChapterSummaryPlaceholder")}
                aria-label={t("novelcrafterChapterSummaryLabel")}
                className="w-full rounded-xl border border-(--border) bg-(--surface-elevated)/50 px-3.5 py-2 text-xs leading-[1.6] text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
              />
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={onGenerateBeats}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50"
                >
                  <Wand2 className="w-3.5 h-3.5 text-(--accent)" />
                  <span>{t("novelcrafterGenerateBeatsBtn")}</span>
                </button>
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={onRewriteBeats}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-(--text-secondary)" />
                  <span>{t("novelcrafterRewriteBeatsBtn")}</span>
                </button>
              </div>
              <button
                type="button"
                disabled={isStreaming}
                onClick={onRunFirstDraft}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("novelcrafterGenerateDraftBtn")}</span>
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
