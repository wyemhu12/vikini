// /app/features/novelcrafter/components/ChapterSelectionToolbar.tsx
"use client";

import React from "react";
import {
  Eye,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type {
  NovelcrafterExpandMode,
  NovelcrafterRewriteMode,
} from "@/lib/features/novelcrafter/types";

interface ChapterSelectionToolbarProps {
  selectedCharCount: number;
  disabled?: boolean;
  onRunRewrite: (mode: NovelcrafterRewriteMode, label: string) => void;
  onRunExpand: (mode: NovelcrafterExpandMode, label: string) => void;
  onRunLineFeedback: (label: string) => void;
  onToggleQuickEdit: () => void;
}

export default function ChapterSelectionToolbar({
  selectedCharCount,
  disabled = false,
  onRunRewrite,
  onRunExpand,
  onRunLineFeedback,
  onToggleQuickEdit,
}: ChapterSelectionToolbarProps) {
  const { t } = useLanguage();

  const btnCls =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--border) bg-(--surface-elevated) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none disabled:opacity-50";

  return (
    <div
      role="toolbar"
      aria-label={t("novelcrafterSelectionToolbarAria")}
      data-testid="chapter-selection-toolbar"
      className="px-6 md:px-12 lg:px-16 pb-2 shrink-0"
    >
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl rounded-xl border border-(--accent)/40 bg-(--surface)/95 px-3 py-2 flex items-center justify-between gap-2 flex-wrap shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunRewrite("rephrase", t("novelcrafterRewriteRephrase"))}
            className={btnCls}
          >
            <RefreshCw className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterRewriteRephrase")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunRewrite("show_dont_tell", t("novelcrafterRewriteShowDontTell"))}
            className={btnCls}
          >
            <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterRewriteShowDontTell")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunRewrite("shorter", t("novelcrafterRewriteShorter"))}
            className={btnCls}
          >
            <Minimize2 className="w-3.5 h-3.5 text-(--text-secondary)" />
            <span>{t("novelcrafterRewriteShorter")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunExpand("expand", t("novelcrafterExpandPassage"))}
            className={btnCls}
          >
            <Maximize2 className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterExpandPassage")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunExpand("describe", t("novelcrafterDescribeAll"))}
            className={btnCls}
          >
            <Eye className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterDescribeAll")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRunLineFeedback(t("novelcrafterFeedbackLine"))}
            className={btnCls}
          >
            <MessageSquareQuote className="w-3.5 h-3.5 text-(--warning)" />
            <span>{t("novelcrafterFeedbackLine")}</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={onToggleQuickEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--accent)/15 border border-(--accent)/40 hover:bg-(--accent)/25 text-xs font-semibold text-(--accent) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{t("novelcrafterQuickEditBtn")}</span>
          </button>
        </div>

        <span className="text-xs font-medium text-(--text-secondary) shrink-0">
          {t("novelcrafterSelectedChars").replace("{count}", selectedCharCount.toLocaleString())}
        </span>
      </div>
    </div>
  );
}
