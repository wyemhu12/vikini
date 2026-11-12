// /app/features/novelcrafter/components/ChapterEmptyStateActions.tsx
"use client";

import React, { useId } from "react";
import { Compass, Feather } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import { cn } from "@/lib/utils/cn";
import {
  MANUSCRIPT_SHEET_CLASS,
  MANUSCRIPT_SHEET_PADDING_CLASS,
} from "../utils/manuscriptSheetClasses";
import PromptSourceTooltip from "./PromptSourceTooltip";

interface ChapterEmptyStateActionsProps {
  disabled?: boolean;
  onAutoWriteOpening: () => void;
  onSuggestThreeOpenings: () => void;
}

export default function ChapterEmptyStateActions({
  disabled = false,
  onAutoWriteOpening,
  onSuggestThreeOpenings,
}: ChapterEmptyStateActionsProps) {
  const { t } = useLanguage();
  const baseId = useId();

  const cards: ReadonlyArray<{
    id: string;
    actionKey: NovelcrafterPromptActionKey;
    title: string;
    desc: string;
    Icon: typeof Feather;
    onClick: () => void;
  }> = [
    {
      id: "auto_write",
      actionKey: "write:auto",
      title: t("novelcrafterEmptyActionAutoWrite"),
      desc: t("novelcrafterEmptyActionAutoWriteDesc"),
      Icon: Feather,
      onClick: onAutoWriteOpening,
    },
    {
      id: "openings_3",
      actionKey: "write:openings_3",
      title: t("novelcrafterEmptyActionOpenings3"),
      desc: t("novelcrafterEmptyActionOpenings3Desc"),
      Icon: Compass,
      onClick: onSuggestThreeOpenings,
    },
  ];

  return (
    <div
      data-testid="chapter-empty-state-actions"
      className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "pb-2.5 shrink-0")}
    >
      <div className={cn(MANUSCRIPT_SHEET_CLASS, "flex flex-wrap items-center gap-2")}>
        <span className="text-xs font-semibold uppercase tracking-wider text-(--muted) mr-1">
          {t("novelcrafterEmptyChapterTitle")}:
        </span>

        {cards.map(({ id, actionKey, title, desc, Icon, onClick }) => {
          const descId = `${baseId}-${id}-desc`;
          return (
            <PromptSourceTooltip key={id} actionKey={actionKey} disabled={disabled} side="bottom">
              <button
                type="button"
                disabled={disabled}
                title={desc}
                aria-describedby={descId}
                onClick={onClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-(--line) bg-(--surface)/80 hover:bg-(--raised) hover:border-(--accent)/50 text-xs font-medium text-(--text) transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              >
                <Icon className="w-3.5 h-3.5 text-(--accent) shrink-0" />
                <span className="font-semibold">{title}</span>
                <span className="hidden 2xl:inline text-(--muted) truncate max-w-48">· {desc}</span>
                <span id={descId} className="sr-only">
                  {desc}
                </span>
              </button>
            </PromptSourceTooltip>
          );
        })}
      </div>
    </div>
  );
}
