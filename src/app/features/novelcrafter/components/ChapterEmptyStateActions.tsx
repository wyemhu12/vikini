// /app/features/novelcrafter/components/ChapterEmptyStateActions.tsx
"use client";

import React, { useId } from "react";
import { Compass, Feather, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  MANUSCRIPT_SHEET_CLASS,
  MANUSCRIPT_SHEET_PADDING_CLASS,
} from "../utils/manuscriptSheetClasses";

interface ChapterEmptyStateActionsProps {
  disabled?: boolean;
  onAutoWriteOpening: () => void;
  onSuggestThreeOpenings: () => void;
  onRoughDraftFromBeats: () => void;
}

export default function ChapterEmptyStateActions({
  disabled = false,
  onAutoWriteOpening,
  onSuggestThreeOpenings,
  onRoughDraftFromBeats,
}: ChapterEmptyStateActionsProps) {
  const { t } = useLanguage();
  const baseId = useId();

  const cards = [
    {
      id: "auto_write",
      title: t("novelcrafterEmptyActionAutoWrite"),
      desc: t("novelcrafterEmptyActionAutoWriteDesc"),
      Icon: Feather,
      onClick: onAutoWriteOpening,
    },
    {
      id: "openings_3",
      title: t("novelcrafterEmptyActionOpenings3"),
      desc: t("novelcrafterEmptyActionOpenings3Desc"),
      Icon: Compass,
      onClick: onSuggestThreeOpenings,
    },
    {
      id: "rough_draft",
      title: t("novelcrafterEmptyActionRoughDraft"),
      desc: t("novelcrafterEmptyActionRoughDraftDesc"),
      Icon: Sparkles,
      onClick: onRoughDraftFromBeats,
    },
  ] as const;

  return (
    <div
      data-testid="chapter-empty-state-actions"
      className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "pb-2.5 shrink-0")}
    >
      <div className={cn(MANUSCRIPT_SHEET_CLASS, "flex flex-wrap items-center gap-2")}>
        <span className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary) mr-1">
          {t("novelcrafterEmptyChapterTitle")}:
        </span>

        {cards.map(({ id, title, desc, Icon, onClick }) => {
          const descId = `${baseId}-${id}-desc`;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={desc}
              aria-describedby={descId}
              onClick={onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-(--border) bg-(--surface-elevated)/80 hover:bg-(--control-bg-hover) hover:border-(--accent)/50 text-xs font-medium text-(--text-primary) transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Icon className="w-3.5 h-3.5 text-(--accent) shrink-0" />
              <span className="font-semibold">{title}</span>
              <span className="hidden 2xl:inline text-(--text-secondary) truncate max-w-48">
                · {desc}
              </span>
              <span id={descId} className="sr-only">
                {desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
