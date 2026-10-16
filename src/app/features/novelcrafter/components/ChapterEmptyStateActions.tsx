// /app/features/novelcrafter/components/ChapterEmptyStateActions.tsx
"use client";

import React from "react";
import { Compass, Feather, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";

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
    <div data-testid="chapter-empty-state-actions" className="px-6 md:px-12 lg:px-16 pb-4 shrink-0">
      <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl rounded-2xl border border-dashed border-(--border) bg-(--surface)/60 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
          {t("novelcrafterEmptyChapterTitle")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {cards.map(({ id, title, desc, Icon, onClick }) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={onClick}
              className="text-left p-3.5 rounded-xl border border-(--border) bg-(--surface-elevated)/80 hover:bg-(--control-bg-hover) hover:border-(--accent)/50 transition-all flex flex-col justify-between gap-1.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <div className="flex items-center gap-2 text-(--accent)">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs md:text-sm font-semibold text-(--text-primary)">
                  {title}
                </span>
              </div>
              <span className="text-xs text-(--text-secondary) leading-relaxed">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
