// /app/features/novelcrafter/components/NovelcrafterViewTabs.tsx
"use client";

import React, { useId, useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import { useLanguage } from "../../chat/hooks/useLanguage";

export type NovelcrafterView = "write" | "outline" | "bible";

export interface NovelcrafterViewIds {
  tab: (view: NovelcrafterView) => string;
  panel: (view: NovelcrafterView) => string;
}

const VIEWS: readonly { id: NovelcrafterView; labelKey: TranslationKey }[] = [
  { id: "write", labelKey: "novelcrafterViewWrite" },
  { id: "outline", labelKey: "novelcrafterViewOutline" },
  { id: "bible", labelKey: "novelcrafterViewBible" },
];

/** Stable ids linking each view tab to its tabpanel. */
export function useNovelcrafterViewIds(): NovelcrafterViewIds {
  const base = useId();
  return useMemo(
    () => ({
      tab: (view: NovelcrafterView) => `${base}-tab-${view}`,
      panel: (view: NovelcrafterView) => `${base}-panel-${view}`,
    }),
    [base]
  );
}

interface NovelcrafterViewTabsProps {
  value: NovelcrafterView;
  onChange: (view: NovelcrafterView) => void;
  ids: NovelcrafterViewIds;
}

/** "Viết / Dàn ý / Hồ sơ" view switch (Vikini 3.0 phase 5B, canvas Novel*). */
export function NovelcrafterViewTabs({ value, onChange, ids }: NovelcrafterViewTabsProps) {
  const { t } = useLanguage();
  const refs = useRef<Partial<Record<NovelcrafterView, HTMLButtonElement | null>>>({});

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = VIEWS.findIndex((v) => v.id === value);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (index + 1) % VIEWS.length;
    if (e.key === "ArrowLeft") next = (index - 1 + VIEWS.length) % VIEWS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = VIEWS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = VIEWS[next].id;
    onChange(target);
    refs.current[target]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("novelcrafterViewTabs")}
      onKeyDown={handleKeyDown}
      className="flex shrink-0 gap-0.5 rounded-[10px] bg-(--raised) p-0.5"
    >
      {VIEWS.map((view) => {
        const selected = view.id === value;
        return (
          <button
            key={view.id}
            ref={(el) => {
              refs.current[view.id] = el;
            }}
            type="button"
            role="tab"
            id={ids.tab(view.id)}
            aria-selected={selected}
            aria-controls={ids.panel(view.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(view.id)}
            className={cn(
              "h-8 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
              selected
                ? "bg-(--surface) font-semibold text-(--text) shadow-sm"
                : "font-medium text-(--muted) hover:text-(--text)"
            )}
          >
            {t(view.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
