// /app/features/novelcrafter/components/StoryBibleTocSidebar.tsx
"use client";

import React from "react";
import { EyeOff, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type { StoryBible } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";

export interface StoryBibleTocSidebarProps {
  storyBible: StoryBible;
  activeSection: NovelcrafterBibleSectionId;
  allExpanded: boolean;
  onSelectSection: (section: NovelcrafterBibleSectionId) => void;
  onToggleExpandAll: () => void;
  onClose?: () => void;
}

const TOC_ITEMS: ReadonlyArray<{
  id: NovelcrafterBibleSectionId;
  labelKey: TranslationKey;
}> = [
  { id: "braindump", labelKey: "novelcrafterBraindumpLabel" },
  { id: "genre", labelKey: "novelcrafterGenreLabel" },
  { id: "style", labelKey: "novelcrafterStyleLabel" },
  { id: "synopsis", labelKey: "novelcrafterSynopsisLabel" },
  { id: "characters", labelKey: "novelcrafterCharactersLabel" },
  { id: "worldbuilding", labelKey: "novelcrafterWorldbuildingLabel" },
  { id: "outline", labelKey: "novelcrafterOutlineLabel" },
];

export function isBibleSectionVisibleToAi(
  storyBible: StoryBible,
  section: NovelcrafterBibleSectionId
): boolean {
  switch (section) {
    case "braindump":
      return storyBible.braindumpVisibleToAI !== false;
    case "genre":
      return storyBible.genreVisibleToAI !== false;
    case "style":
      return storyBible.styleVisibleToAI !== false;
    case "synopsis":
      return storyBible.synopsisVisibleToAI !== false;
    case "characters":
      return storyBible.charactersVisibleToAI !== false;
    case "worldbuilding":
      return storyBible.worldbuildingVisibleToAI !== false;
    case "outline":
      return storyBible.outlineVisibleToAI !== false;
  }
}

function getSectionCount(storyBible: StoryBible, section: NovelcrafterBibleSectionId): number {
  if (section === "characters") return (storyBible.characterCards ?? []).length;
  if (section === "worldbuilding") return (storyBible.worldElements ?? []).length;
  if (section === "outline") return (storyBible.outlineItems ?? []).length;
  return 0;
}

export default function StoryBibleTocSidebar({
  storyBible,
  activeSection,
  allExpanded,
  onSelectSection,
  onToggleExpandAll,
  onClose,
}: StoryBibleTocSidebarProps) {
  const { t } = useLanguage();

  return (
    <aside
      aria-label={t("novelcrafterBibleTocAria")}
      className="w-full md:w-[232px] shrink-0 border-b md:border-b-0 md:border-r border-(--line) bg-(--surface) px-4 py-3 md:px-3 md:py-5 flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1.5 px-1 md:px-2 pb-1 md:pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif italic text-lg md:text-[22px] text-(--text) leading-tight truncate min-w-0">
            {t("novelcrafterStoryBibleTitle")}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="p-1.5 rounded-lg text-(--muted) hover:text-(--text) hover:bg-(--raised) transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="hidden md:block text-xs text-(--faint) leading-relaxed">
          {t("novelcrafterStoryBibleSubtitle")}
        </p>
        <button
          type="button"
          onClick={onToggleExpandAll}
          className="self-start px-2.5 py-1 rounded-lg border border-(--line) bg-(--raised) hover:border-(--muted) text-xs font-medium text-(--muted) hover:text-(--text) transition-colors"
        >
          {allExpanded ? t("novelcrafterCollapseBible") : t("novelcrafterExpandBible")}
        </button>
      </div>

      <nav
        aria-label={t("novelcrafterBibleTocAria")}
        className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 custom-scrollbar"
      >
        {TOC_ITEMS.map((item) => {
          const active = activeSection === item.id;
          const hidden = !isBibleSectionVisibleToAi(storyBible, item.id);
          const count = getSectionCount(storyBible, item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "h-9 px-2.5 rounded-lg flex items-center gap-2 text-left text-xs md:text-sm shrink-0 md:shrink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                active
                  ? "bg-(--soft) text-(--accent) font-semibold"
                  : "text-(--muted) hover:text-(--text) hover:bg-(--raised)/70 font-normal"
              )}
            >
              <span className="flex-1 min-w-0 truncate">{t(item.labelKey)}</span>
              {hidden && (
                <span
                  role="img"
                  aria-label={t("novelcrafterHiddenFromAI")}
                  data-testid={`bible-toc-hidden-${item.id}`}
                  className="inline-flex items-center text-(--faint) shrink-0"
                >
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              )}
              {count > 0 && (
                <span
                  data-testid={`bible-toc-count-${item.id}`}
                  className="text-xs text-(--faint) font-normal tabular-nums shrink-0"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="hidden md:block mt-auto pt-3 px-2 border-t border-(--line) text-xs leading-relaxed text-(--faint)">
        {t("novelcrafterBibleTocHiddenNote")}
      </div>
    </aside>
  );
}
