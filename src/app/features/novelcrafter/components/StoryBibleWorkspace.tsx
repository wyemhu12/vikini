// /app/features/novelcrafter/components/StoryBibleWorkspace.tsx
"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  NOVELCRAFTER_POV_OPTIONS,
  NOVELCRAFTER_STYLE_MODES,
  NOVELCRAFTER_TENSE_OPTIONS,
  type NovelcrafterActionMode,
  type NovelcrafterPovOption,
  type NovelcrafterStyleMode,
  type NovelcrafterTenseOption,
  type StoryBible,
} from "@/lib/features/novelcrafter/types";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import type { TranslationKey } from "@/lib/utils/translations";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import StoryBibleSectionCard, { type BibleAiSection } from "./StoryBibleSectionCard";

export interface StoryBibleWorkspaceProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  activeSection?: NovelcrafterBibleSectionId;
  jumpRequest?: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  embedded?: boolean;
  onClose?: () => void;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
}

const STYLE_MODE_LABELS: Record<
  NovelcrafterStyleMode,
  { title: TranslationKey; desc: TranslationKey }
> = {
  featured: { title: "novelcrafterStyleFeatured", desc: "novelcrafterStyleFeaturedDesc" },
  match: { title: "novelcrafterStyleMatch", desc: "novelcrafterStyleMatchDesc" },
  custom: { title: "novelcrafterStyleCustom", desc: "novelcrafterStyleCustomDesc" },
};

const POV_LABELS: Record<NovelcrafterPovOption, TranslationKey> = {
  first_person: "novelcrafterPovFirst",
  second_person: "novelcrafterPovSecond",
  third_person_limited: "novelcrafterPovThirdLimited",
  third_person_omniscient: "novelcrafterPovThirdOmniscient",
  third_person_objective: "novelcrafterPovThirdObjective",
};

const TENSE_LABELS: Record<NovelcrafterTenseOption, TranslationKey> = {
  past: "novelcrafterTensePast",
  present: "novelcrafterTensePresent",
  future: "novelcrafterTenseFuture",
};

const ALL_SECTIONS: ReadonlyArray<NovelcrafterBibleSectionId> = [
  "braindump",
  "genre",
  "style",
  "synopsis",
  "characters",
  "worldbuilding",
  "outline",
];

const TEXTAREA_CLS =
  "w-full rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-[14px] leading-[1.65] text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y";

export default function StoryBibleWorkspace({
  storyBible,
  onUpdateStoryBible,
  jumpRequest,
  embedded = false,
  onClose,
  isStreaming,
  onTriggerStream,
}: StoryBibleWorkspaceProps) {
  const { t } = useLanguage();

  const [openSections, setOpenSections] = useState<Record<NovelcrafterBibleSectionId, boolean>>({
    braindump: true,
    genre: true,
    style: true,
    synopsis: true,
    characters: true,
    worldbuilding: true,
    outline: true,
  });

  // Scroll to section only upon explicit user jumpRequest (eliminates cold-start auto-scroll bug)
  useEffect(() => {
    if (!jumpRequest?.section) return;
    const target = jumpRequest.section;
    setOpenSections((prev) => ({ ...prev, [target]: true }));
    const timer = setTimeout(() => {
      const el = document.getElementById(`bible-section-${target}`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [jumpRequest]);

  const toggleSection = (id: NovelcrafterBibleSectionId) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleRunAi = (
    target: BibleAiSection,
    mode: NovelcrafterActionMode,
    label: string,
    customInstruction?: string
  ) => {
    void onTriggerStream({
      feature: "bible",
      bibleTarget: target,
      actionMode: mode,
      subLabel: label,
      customInstruction: customInstruction || "",
    });
  };

  const content = (
    <div className={cn("space-y-4", embedded ? "w-full" : "max-w-[880px] mx-auto")}>
      {!embedded && (
        <div className="rounded-2xl border border-(--border) bg-(--surface-elevated)/60 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-(--control-bg) border border-(--control-border) text-(--accent) shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-(--text-primary)">
                {t("novelcrafterStoryBibleTitle")}
              </h1>
              <p className="text-xs md:text-sm text-(--text-secondary)">
                {t("novelcrafterStoryBibleSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !ALL_SECTIONS.every((s) => openSections[s]);
                setOpenSections({
                  braindump: next,
                  genre: next,
                  style: next,
                  synopsis: next,
                  characters: next,
                  worldbuilding: next,
                  outline: next,
                });
              }}
              className="px-3 py-1.5 rounded-full border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary)"
            >
              {ALL_SECTIONS.every((s) => openSections[s])
                ? t("novelcrafterCollapseBible")
                : t("novelcrafterExpandBible")}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. Braindump */}
      <StoryBibleSectionCard
        id="braindump"
        titleKey="novelcrafterBraindumpLabel"
        subtitleKey="novelcrafterBraindumpDesc"
        isOpen={openSections.braindump}
        onToggle={() => toggleSection("braindump")}
        wordCount={countChapterWords(storyBible.braindump)}
      >
        <textarea
          rows={5}
          value={storyBible.braindump}
          onChange={(e) => onUpdateStoryBible({ braindump: e.target.value })}
          placeholder={t("novelcrafterBraindumpPlaceholder")}
          aria-label={t("novelcrafterBraindumpLabel")}
          className={TEXTAREA_CLS}
        />
      </StoryBibleSectionCard>

      {/* 2. Genre */}
      <StoryBibleSectionCard
        id="genre"
        titleKey="novelcrafterGenreLabel"
        subtitleKey="novelcrafterGenreDesc"
        isOpen={openSections.genre}
        onToggle={() => toggleSection("genre")}
      >
        <input
          type="text"
          value={storyBible.genre}
          onChange={(e) => onUpdateStoryBible({ genre: e.target.value })}
          placeholder={t("novelcrafterGenrePlaceholder")}
          aria-label={t("novelcrafterGenreLabel")}
          className="w-full h-10 rounded-xl border border-(--border) bg-(--surface) px-4 text-xs md:text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        />
      </StoryBibleSectionCard>

      {/* 3. Style */}
      <StoryBibleSectionCard
        id="style"
        titleKey="novelcrafterStyleLabel"
        subtitleKey="novelcrafterStyleDesc"
        isOpen={openSections.style}
        onToggle={() => toggleSection("style")}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {NOVELCRAFTER_STYLE_MODES.map((mode) => {
              const active = storyBible.styleMode === mode;
              const meta = STYLE_MODE_LABELS[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdateStoryBible({ styleMode: mode })}
                  aria-pressed={active}
                  className={cn(
                    "text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-1",
                    active
                      ? "bg-(--accent)/10 border-(--accent) text-(--accent)"
                      : "bg-(--surface) border-(--border) text-(--text-primary) hover:border-(--control-border)"
                  )}
                >
                  <span className="text-xs font-semibold">{t(meta.title)}</span>
                  <span className="text-[11px] text-(--text-secondary) leading-tight">
                    {t(meta.desc)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-(--text-secondary)">
                {t("novelcrafterPovLabel")}
              </label>
              <select
                value={storyBible.pov}
                onChange={(e) =>
                  onUpdateStoryBible({ pov: e.target.value as NovelcrafterPovOption })
                }
                className="w-full h-9 rounded-xl border border-(--border) bg-(--surface) px-3 text-xs text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                {NOVELCRAFTER_POV_OPTIONS.map((pov) => (
                  <option key={pov} value={pov} className="bg-(--surface-elevated)">
                    {t(POV_LABELS[pov])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-(--text-secondary)">
                {t("novelcrafterTenseLabel")}
              </label>
              <select
                value={storyBible.tense}
                onChange={(e) =>
                  onUpdateStoryBible({ tense: e.target.value as NovelcrafterTenseOption })
                }
                className="w-full h-9 rounded-xl border border-(--border) bg-(--surface) px-3 text-xs text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                {NOVELCRAFTER_TENSE_OPTIONS.map((tense) => (
                  <option key={tense} value={tense} className="bg-(--surface-elevated)">
                    {t(TENSE_LABELS[tense])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            rows={3}
            value={storyBible.style}
            onChange={(e) => onUpdateStoryBible({ style: e.target.value })}
            placeholder={t("novelcrafterStyleCustomPlaceholder")}
            aria-label={t("novelcrafterStyleCustomPlaceholder")}
            className={TEXTAREA_CLS}
          />
        </div>
      </StoryBibleSectionCard>

      {/* 4. Synopsis */}
      <StoryBibleSectionCard
        id="synopsis"
        titleKey="novelcrafterSynopsisLabel"
        subtitleKey="novelcrafterSynopsisDesc"
        isOpen={openSections.synopsis}
        onToggle={() => toggleSection("synopsis")}
        wordCount={countChapterWords(storyBible.synopsis)}
        aiTarget="synopsis"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <textarea
          rows={5}
          value={storyBible.synopsis}
          onChange={(e) => onUpdateStoryBible({ synopsis: e.target.value })}
          placeholder={t("novelcrafterSynopsisPlaceholder")}
          aria-label={t("novelcrafterSynopsisLabel")}
          className={TEXTAREA_CLS}
        />
      </StoryBibleSectionCard>

      {/* 5. Characters */}
      <StoryBibleSectionCard
        id="characters"
        titleKey="novelcrafterCharactersLabel"
        subtitleKey="novelcrafterCharactersDesc"
        isOpen={openSections.characters}
        onToggle={() => toggleSection("characters")}
        wordCount={countChapterWords(storyBible.characters)}
        visibleToAi={storyBible.charactersVisibleToAI}
        onToggleVisibleToAi={() =>
          onUpdateStoryBible({ charactersVisibleToAI: !storyBible.charactersVisibleToAI })
        }
        aiTarget="characters"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <textarea
          rows={6}
          value={storyBible.characters}
          onChange={(e) => onUpdateStoryBible({ characters: e.target.value })}
          placeholder={t("novelcrafterCharactersPlaceholder")}
          aria-label={t("novelcrafterCharactersLabel")}
          className={TEXTAREA_CLS}
        />
      </StoryBibleSectionCard>

      {/* 6. Worldbuilding */}
      <StoryBibleSectionCard
        id="worldbuilding"
        titleKey="novelcrafterWorldbuildingLabel"
        subtitleKey="novelcrafterWorldbuildingDesc"
        isOpen={openSections.worldbuilding}
        onToggle={() => toggleSection("worldbuilding")}
        wordCount={countChapterWords(storyBible.worldbuilding)}
        visibleToAi={storyBible.worldbuildingVisibleToAI}
        onToggleVisibleToAi={() =>
          onUpdateStoryBible({ worldbuildingVisibleToAI: !storyBible.worldbuildingVisibleToAI })
        }
        aiTarget="worldbuilding"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <textarea
          rows={6}
          value={storyBible.worldbuilding}
          onChange={(e) => onUpdateStoryBible({ worldbuilding: e.target.value })}
          placeholder={t("novelcrafterWorldbuildingPlaceholder")}
          aria-label={t("novelcrafterWorldbuildingLabel")}
          className={TEXTAREA_CLS}
        />
      </StoryBibleSectionCard>

      {/* 7. Outline */}
      <StoryBibleSectionCard
        id="outline"
        titleKey="novelcrafterOutlineLabel"
        subtitleKey="novelcrafterOutlineDesc"
        isOpen={openSections.outline}
        onToggle={() => toggleSection("outline")}
        wordCount={countChapterWords(storyBible.outline)}
        aiTarget="outline"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <textarea
          rows={6}
          value={storyBible.outline}
          onChange={(e) => onUpdateStoryBible({ outline: e.target.value })}
          placeholder={t("novelcrafterOutlinePlaceholder")}
          aria-label={t("novelcrafterOutlineLabel")}
          className={TEXTAREA_CLS}
        />
      </StoryBibleSectionCard>
    </div>
  );

  if (embedded) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar bg-(--surface)">
      {content}
    </div>
  );
}
