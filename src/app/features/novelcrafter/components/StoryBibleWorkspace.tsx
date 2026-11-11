// /app/features/novelcrafter/components/StoryBibleWorkspace.tsx
"use client";

import React, { useEffect, useId, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  NOVELCRAFTER_POV_OPTIONS,
  NOVELCRAFTER_STYLE_MODES,
  NOVELCRAFTER_TENSE_OPTIONS,
  type NovelcrafterActionMode,
  type NovelcrafterChapter,
  type NovelcrafterPovOption,
  type NovelcrafterStyleMode,
  type NovelcrafterTenseOption,
  type StoryBible,
  type StoryBibleCharacterCard,
} from "@/lib/features/novelcrafter/types";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import type { TranslationKey } from "@/lib/utils/translations";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import StoryBibleCharacterPanel, { StoryBibleCharacterSheet } from "./StoryBibleCharacterPanel";
import StoryBibleSectionCard, { type BibleAiSection } from "./StoryBibleSectionCard";
import {
  StoryBibleCharacterCardsList,
  StoryBibleOutlineItemsList,
  StoryBibleWorldElementsList,
} from "./StoryBibleStructuredCards";
import StoryBibleTocSidebar, { isBibleSectionVisibleToAi } from "./StoryBibleTocSidebar";

export interface StoryBibleWorkspaceProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  chapters?: readonly NovelcrafterChapter[];
  onOpenChapter?: (chapterId: string) => void;
  activeSection?: NovelcrafterBibleSectionId;
  jumpRequest?: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  embedded?: boolean;
  onClose?: () => void;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onSendOutlineToChapterScenes?: (beats: string) => void;
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

const VISIBILITY_PROP_BY_SECTION: Record<NovelcrafterBibleSectionId, keyof StoryBible> = {
  braindump: "braindumpVisibleToAI",
  genre: "genreVisibleToAI",
  style: "styleVisibleToAI",
  synopsis: "synopsisVisibleToAI",
  characters: "charactersVisibleToAI",
  worldbuilding: "worldbuildingVisibleToAI",
  outline: "outlineVisibleToAI",
};

const TEXTAREA_CLS =
  "w-full rounded-xl border border-(--line) bg-(--surface) px-4 py-3 text-[14px] leading-[1.65] text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:outline-none resize-y";

function readIsDesktopXl(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(min-width: 1024px)").matches;
}

function createAllOpenState(open: boolean): Record<NovelcrafterBibleSectionId, boolean> {
  return Object.fromEntries(ALL_SECTIONS.map((s) => [s, open])) as Record<
    NovelcrafterBibleSectionId,
    boolean
  >;
}

export default function StoryBibleWorkspace({
  storyBible,
  onUpdateStoryBible,
  chapters = [],
  onOpenChapter,
  activeSection,
  jumpRequest,
  embedded = false,
  onClose,
  isStreaming,
  onTriggerStream,
  onSendOutlineToChapterScenes,
}: StoryBibleWorkspaceProps) {
  const { t } = useLanguage();
  const povSelectId = useId();
  const tenseSelectId = useId();
  const sectionHeadingLevel: 2 | 3 = 3;
  const [currentSection, setCurrentSection] = useState<NovelcrafterBibleSectionId>(
    activeSection ?? "braindump"
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isDesktopXl, setIsDesktopXl] = useState<boolean>(readIsDesktopXl);
  const [openSections, setOpenSections] = useState<Record<NovelcrafterBibleSectionId, boolean>>(
    () => createAllOpenState(true)
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktopXl(e.matches);
    setIsDesktopXl(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const scrollToSection = (target: NovelcrafterBibleSectionId) => {
    setCurrentSection(target);
    setOpenSections((prev) => ({ ...prev, [target]: true }));
    setTimeout(() => {
      const el = document.getElementById(`bible-section-${target}`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  useEffect(() => {
    if (!jumpRequest?.section) return;
    scrollToSection(jumpRequest.section);
  }, [jumpRequest]);

  const toggleSection = (id: NovelcrafterBibleSectionId) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleExpandAll = () =>
    setOpenSections(createAllOpenState(!ALL_SECTIONS.every((s) => openSections[s])));

  const sectionCardCommon = (id: NovelcrafterBibleSectionId) => {
    const vis = isBibleSectionVisibleToAi(storyBible, id);
    const prop = VISIBILITY_PROP_BY_SECTION[id];
    return {
      id,
      isOpen: openSections[id],
      onToggle: () => toggleSection(id),
      visibleToAi: vis,
      onToggleVisibleToAi: () => onUpdateStoryBible({ [prop]: !vis } as Partial<StoryBible>),
      headingLevel: sectionHeadingLevel,
    };
  };

  const handleRunAi = (
    target: BibleAiSection,
    mode: NovelcrafterActionMode,
    label: string,
    customInstruction?: string
  ) => {
    if (isStreaming) return;
    void onTriggerStream({
      feature: "bible",
      bibleTarget: target,
      actionMode: mode,
      subLabel: label,
      customInstruction: customInstruction || "",
    });
  };

  const cards = storyBible.characterCards ?? [];
  const selectedCharacter = selectedCharacterId
    ? (cards.find((c) => c.id === selectedCharacterId) ?? null)
    : null;

  const updateChar = (id: string, patch: Partial<Omit<StoryBibleCharacterCard, "id">>) =>
    onUpdateStoryBible({
      characterCards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const deleteChar = (id: string) => {
    onUpdateStoryBible({ characterCards: cards.filter((c) => c.id !== id) });
    setSelectedCharacterId(null);
  };

  const povOptions = NOVELCRAFTER_POV_OPTIONS.map((pov) => (
    <option key={pov} value={pov} className="bg-(--raised)">
      {t(POV_LABELS[pov])}
    </option>
  ));
  const tenseOptions = NOVELCRAFTER_TENSE_OPTIONS.map((tense) => (
    <option key={tense} value={tense} className="bg-(--raised)">
      {t(TENSE_LABELS[tense])}
    </option>
  ));

  const sectionsContent = (
    <div className={cn("space-y-4", embedded ? "w-full" : "max-w-[880px] mx-auto")}>
      <StoryBibleSectionCard
        {...sectionCardCommon("braindump")}
        titleKey="novelcrafterBraindumpLabel"
        subtitleKey="novelcrafterBraindumpDesc"
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

      <StoryBibleSectionCard
        {...sectionCardCommon("genre")}
        titleKey="novelcrafterGenreLabel"
        subtitleKey="novelcrafterGenreDesc"
      >
        <input
          type="text"
          value={storyBible.genre}
          onChange={(e) => onUpdateStoryBible({ genre: e.target.value })}
          placeholder={t("novelcrafterGenrePlaceholder")}
          aria-label={t("novelcrafterGenreLabel")}
          className="w-full h-10 rounded-xl border border-(--line) bg-(--surface) px-4 text-xs md:text-sm text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:outline-none"
        />
      </StoryBibleSectionCard>

      <StoryBibleSectionCard
        {...sectionCardCommon("style")}
        titleKey="novelcrafterStyleLabel"
        subtitleKey="novelcrafterStyleDesc"
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
                      ? "bg-(--soft) border-(--accent) text-(--accent)"
                      : "bg-(--surface) border-(--line) text-(--text) hover:border-(--muted)"
                  )}
                >
                  <span className="text-xs font-semibold">{t(meta.title)}</span>
                  <span className="text-xs text-(--muted) leading-tight">{t(meta.desc)}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={povSelectId} className="text-xs font-medium text-(--muted)">
                {t("novelcrafterPovLabel")}
              </label>
              <select
                id={povSelectId}
                value={storyBible.pov}
                onChange={(e) =>
                  onUpdateStoryBible({ pov: e.target.value as NovelcrafterPovOption })
                }
                className="w-full h-9 rounded-xl border border-(--line) bg-(--surface) px-3 text-xs text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
              >
                {povOptions}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={tenseSelectId} className="text-xs font-medium text-(--muted)">
                {t("novelcrafterTenseLabel")}
              </label>
              <select
                id={tenseSelectId}
                value={storyBible.tense}
                onChange={(e) =>
                  onUpdateStoryBible({ tense: e.target.value as NovelcrafterTenseOption })
                }
                className="w-full h-9 rounded-xl border border-(--line) bg-(--surface) px-3 text-xs text-(--text) focus-visible:ring-2 focus-visible:ring-(--accent)"
              >
                {tenseOptions}
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

      <StoryBibleSectionCard
        {...sectionCardCommon("synopsis")}
        titleKey="novelcrafterSynopsisLabel"
        subtitleKey="novelcrafterSynopsisDesc"
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

      <StoryBibleSectionCard
        {...sectionCardCommon("characters")}
        titleKey="novelcrafterCharactersLabel"
        subtitleKey="novelcrafterCharactersDesc"
        wordCount={countChapterWords(storyBible.characters)}
        aiTarget="characters"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <div className="space-y-3">
          <textarea
            rows={4}
            value={storyBible.characters}
            onChange={(e) => onUpdateStoryBible({ characters: e.target.value })}
            placeholder={t("novelcrafterCharactersPlaceholder")}
            aria-label={t("novelcrafterCharactersLabel")}
            className={TEXTAREA_CLS}
          />
          <StoryBibleCharacterCardsList
            storyBible={storyBible}
            onUpdateStoryBible={onUpdateStoryBible}
            chapters={chapters}
            selectedCharacterId={selectedCharacterId}
            onSelectCharacter={setSelectedCharacterId}
            onOpenChapter={onOpenChapter}
          />
        </div>
      </StoryBibleSectionCard>

      <StoryBibleSectionCard
        {...sectionCardCommon("worldbuilding")}
        titleKey="novelcrafterWorldbuildingLabel"
        subtitleKey="novelcrafterWorldbuildingDesc"
        wordCount={countChapterWords(storyBible.worldbuilding)}
        aiTarget="worldbuilding"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <div className="space-y-3">
          <textarea
            rows={5}
            value={storyBible.worldbuilding}
            onChange={(e) => onUpdateStoryBible({ worldbuilding: e.target.value })}
            placeholder={t("novelcrafterWorldbuildingPlaceholder")}
            aria-label={t("novelcrafterWorldbuildingLabel")}
            className={TEXTAREA_CLS}
          />
          <StoryBibleWorldElementsList
            storyBible={storyBible}
            onUpdateStoryBible={onUpdateStoryBible}
          />
        </div>
      </StoryBibleSectionCard>

      <StoryBibleSectionCard
        {...sectionCardCommon("outline")}
        titleKey="novelcrafterOutlineLabel"
        subtitleKey="novelcrafterOutlineDesc"
        wordCount={countChapterWords(storyBible.outline)}
        aiTarget="outline"
        isStreaming={isStreaming}
        onRunAiAction={handleRunAi}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={storyBible.pov}
              onChange={(e) => onUpdateStoryBible({ pov: e.target.value as NovelcrafterPovOption })}
              aria-label={t("novelcrafterOutlinePovLabel")}
              className="h-7 rounded-full border border-(--line) bg-(--raised) px-2.5 text-xs font-medium text-(--text)"
            >
              {povOptions}
            </select>
            <select
              value={storyBible.tense}
              onChange={(e) =>
                onUpdateStoryBible({ tense: e.target.value as NovelcrafterTenseOption })
              }
              aria-label={t("novelcrafterOutlineTenseLabel")}
              className="h-7 rounded-full border border-(--line) bg-(--raised) px-2.5 text-xs font-medium text-(--text)"
            >
              {tenseOptions}
            </select>
          </div>
          <textarea
            rows={5}
            value={storyBible.outline}
            onChange={(e) => onUpdateStoryBible({ outline: e.target.value })}
            placeholder={t("novelcrafterOutlinePlaceholder")}
            aria-label={t("novelcrafterOutlineLabel")}
            className={TEXTAREA_CLS}
          />
          <StoryBibleOutlineItemsList
            storyBible={storyBible}
            onUpdateStoryBible={onUpdateStoryBible}
            onSendToChapterScenes={onSendOutlineToChapterScenes}
          />
        </div>
      </StoryBibleSectionCard>
    </div>
  );

  const characterSheet =
    (embedded || !isDesktopXl) && selectedCharacter ? (
      <StoryBibleCharacterSheet
        card={selectedCharacter}
        chapters={chapters}
        onUpdateCard={(patch) => updateChar(selectedCharacter.id, patch)}
        onDeleteCard={() => deleteChar(selectedCharacter.id)}
        onClose={() => setSelectedCharacterId(null)}
        onOpenChapter={onOpenChapter}
      />
    ) : null;

  if (embedded) {
    return (
      <div className="w-full">
        {sectionsContent}
        {characterSheet}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-(--bg)">
      <StoryBibleTocSidebar
        storyBible={storyBible}
        activeSection={currentSection}
        allExpanded={ALL_SECTIONS.every((s) => openSections[s])}
        onSelectSection={scrollToSection}
        onToggleExpandAll={toggleExpandAll}
        onClose={onClose}
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
        {sectionsContent}
      </div>
      {isDesktopXl && selectedCharacter && (
        <aside
          aria-label={`${t("novelcrafterCharacterDetailLabel")} ${selectedCharacter.name}`}
          className="hidden lg:flex flex-col w-[320px] xl:w-[360px] shrink-0 border-l border-(--line) bg-(--surface) overflow-y-auto custom-scrollbar"
        >
          <StoryBibleCharacterPanel
            card={selectedCharacter}
            chapters={chapters}
            onUpdateCard={(patch) => updateChar(selectedCharacter.id, patch)}
            onDeleteCard={() => deleteChar(selectedCharacter.id)}
            onClose={() => setSelectedCharacterId(null)}
            onOpenChapter={onOpenChapter}
          />
        </aside>
      )}
      {characterSheet}
    </div>
  );
}
