// /app/features/novelcrafter/components/StoryBibleWorkspace.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  NOVELCRAFTER_POV_OPTIONS,
  NOVELCRAFTER_STYLE_MODES,
  NOVELCRAFTER_TENSE_OPTIONS,
  type NovelcrafterActionMode,
  type NovelcrafterBibleTarget,
  type NovelcrafterPovOption,
  type NovelcrafterStyleMode,
  type NovelcrafterTenseOption,
  type StoryBible,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";

interface StoryBibleWorkspaceProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  activeSection?: NovelcrafterBibleSectionId;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
}

type BibleAiSection = Exclude<NovelcrafterBibleTarget, "scenes" | "draft">;

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
  "w-full rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-[15px] leading-[1.7] text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y";

export default function StoryBibleWorkspace({
  storyBible,
  onUpdateStoryBible,
  activeSection,
  isStreaming,
  onTriggerStream,
}: StoryBibleWorkspaceProps) {
  const { t } = useLanguage();
  const sectionRefs = useRef<Record<NovelcrafterBibleSectionId, HTMLElement | null>>({
    braindump: null,
    genre: null,
    style: null,
    synopsis: null,
    characters: null,
    worldbuilding: null,
    outline: null,
  });

  const [openSections, setOpenSections] = useState<Record<NovelcrafterBibleSectionId, boolean>>({
    braindump: true,
    genre: true,
    style: true,
    synopsis: true,
    characters: true,
    worldbuilding: true,
    outline: true,
  });

  const [rewriteOpenSection, setRewriteOpenSection] = useState<BibleAiSection | null>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState<Record<BibleAiSection, string>>({
    synopsis: "",
    characters: "",
    worldbuilding: "",
    outline: "",
  });

  useEffect(() => {
    if (!activeSection) return;
    setOpenSections((prev) => ({ ...prev, [activeSection]: true }));
    const el = sectionRefs.current[activeSection];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection]);

  const toggleSection = (id: NovelcrafterBibleSectionId) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleRunBibleAction = (
    target: BibleAiSection,
    actionMode: NovelcrafterActionMode,
    label: string
  ) => {
    const customInstruction =
      actionMode === "rewrite" ? rewriteInstructions[target]?.trim() || "" : "";
    void onTriggerStream({
      feature: "bible",
      bibleTarget: target,
      actionMode,
      subLabel: label,
      customInstruction,
    });
    if (actionMode === "rewrite") setRewriteOpenSection(null);
  };

  const renderAiControls = (target: BibleAiSection, titleLabel: string) => {
    const isRewriteOpen = rewriteOpenSection === target;
    const genLabel =
      target === "outline"
        ? t("novelcrafterGenerateOutlineCta")
        : `${t("novelcrafterGenerateBtn")}: ${titleLabel}`;
    return (
      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleRunBibleAction(target, "generate", genLabel)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold shadow-xs transition-all"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>
              {target === "outline"
                ? t("novelcrafterGenerateOutlineCta")
                : t("novelcrafterGenerateBtn")}
            </span>
          </button>
          <button
            type="button"
            disabled={isStreaming}
            aria-pressed={isRewriteOpen}
            onClick={() => setRewriteOpenSection(isRewriteOpen ? null : target)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors disabled:opacity-50",
              isRewriteOpen
                ? "bg-(--control-bg-hover) border-(--accent) text-(--accent)"
                : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
            )}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("novelcrafterRewriteBtn")}</span>
          </button>
        </div>
        {isRewriteOpen && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={rewriteInstructions[target]}
              onChange={(e) =>
                setRewriteInstructions((prev) => ({ ...prev, [target]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isStreaming)
                  handleRunBibleAction(
                    target,
                    "rewrite",
                    `${t("novelcrafterRewriteBtn")}: ${titleLabel}`
                  );
              }}
              placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
              aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
              className="flex-1 min-w-0 h-9 rounded-xl border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            />
            <button
              type="button"
              disabled={isStreaming}
              onClick={() =>
                handleRunBibleAction(
                  target,
                  "rewrite",
                  `${t("novelcrafterRewriteBtn")}: ${titleLabel}`
                )
              }
              className="h-9 px-3 rounded-xl bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold shrink-0"
            >
              {t("novelcrafterRunAction")}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderVisibilityToggle = (visible: boolean, onToggle: () => void) => (
    <button
      type="button"
      aria-pressed={visible}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium",
        visible
          ? "bg-(--success)/10 border-(--success)/30 text-(--success)"
          : "bg-(--control-bg) border-(--border) text-(--text-secondary)"
      )}
    >
      {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      <span>{visible ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")}</span>
    </button>
  );

  const renderSectionHeader = (
    id: NovelcrafterBibleSectionId,
    titleKey: TranslationKey,
    subtitleKey: TranslationKey,
    extraRight?: React.ReactNode
  ) => {
    const isOpen = openSections[id];
    return (
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleSection(id)}
          className="text-left flex items-start gap-2.5 flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-lg"
        >
          <span className="mt-1 p-1 rounded-md bg-(--control-bg) text-(--accent) shrink-0">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-[16px] md:text-[17px] font-semibold text-(--text-primary)">
              {t(titleKey)}
            </h2>
            <p className="text-[13px] text-(--text-secondary) leading-relaxed">{t(subtitleKey)}</p>
          </div>
        </button>
        {extraRight && <div className="shrink-0">{extraRight}</div>}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar bg-(--surface)">
      <div className="max-w-[880px] mx-auto space-y-4">
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
            {t("novelcrafterStoryBibleTab")}
          </button>
        </div>

        {(
          [
            {
              id: "braindump",
              field: "braindump",
              rows: 5,
              label: "novelcrafterBraindumpLabel",
              desc: "novelcrafterBraindumpDesc",
              ph: "novelcrafterBraindumpPlaceholder",
            },
            {
              id: "genre",
              field: "genre",
              rows: 2,
              label: "novelcrafterGenreLabel",
              desc: "novelcrafterGenreDesc",
              ph: "novelcrafterGenrePlaceholder",
            },
          ] as const
        ).map((sec) => (
          <section
            key={sec.id}
            ref={(el) => {
              sectionRefs.current[sec.id] = el;
            }}
            className="rounded-2xl border border-(--border) bg-(--surface-elevated)/50 p-5 space-y-3"
          >
            {renderSectionHeader(sec.id, sec.label, sec.desc)}
            {openSections[sec.id] && (
              <textarea
                rows={sec.rows}
                value={storyBible[sec.field]}
                onChange={(e) => onUpdateStoryBible({ [sec.field]: e.target.value })}
                placeholder={t(sec.ph)}
                aria-label={t(sec.label)}
                className={TEXTAREA_CLS}
              />
            )}
          </section>
        ))}

        {/* 3. Style */}
        <section
          ref={(el) => {
            sectionRefs.current.style = el;
          }}
          className="rounded-2xl border border-(--border) bg-(--surface-elevated)/50 p-5 space-y-3.5"
        >
          {renderSectionHeader("style", "novelcrafterStyleLabel", "novelcrafterStyleDesc")}
          {openSections.style && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {NOVELCRAFTER_STYLE_MODES.map((mode) => {
                  const active = (storyBible.styleMode ?? "custom") === mode;
                  const info = STYLE_MODE_LABELS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateStoryBible({ styleMode: mode })}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all",
                        active
                          ? "bg-(--accent)/15 border-(--accent) text-(--text-primary)"
                          : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                      )}
                    >
                      <p className="text-xs font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
                        <span>{t(info.title)}</span>
                      </p>
                      <p className="text-[11px] opacity-80 mt-0.5">{t(info.desc)}</p>
                    </button>
                  );
                })}
              </div>
              <textarea
                rows={3}
                value={storyBible.style}
                onChange={(e) => onUpdateStoryBible({ style: e.target.value })}
                placeholder={t("novelcrafterStylePlaceholder")}
                aria-label={t("novelcrafterStyleLabel")}
                className={TEXTAREA_CLS}
              />
            </div>
          )}
        </section>

        {(
          [
            {
              id: "synopsis",
              label: "novelcrafterSynopsisLabel",
              desc: "novelcrafterSynopsisDesc",
              ph: "novelcrafterSynopsisPlaceholder",
              visField: null,
            },
            {
              id: "characters",
              label: "novelcrafterCharactersLabel",
              desc: "novelcrafterCharactersDesc",
              ph: "novelcrafterCharactersPlaceholder",
              visField: "charactersVisibleToAI",
            },
            {
              id: "worldbuilding",
              label: "novelcrafterWorldbuildingLabel",
              desc: "novelcrafterWorldbuildingDesc",
              ph: "novelcrafterWorldbuildingPlaceholder",
              visField: "worldbuildingVisibleToAI",
            },
          ] as const
        ).map((sec) => (
          <section
            key={sec.id}
            ref={(el) => {
              sectionRefs.current[sec.id] = el;
            }}
            className="rounded-2xl border border-(--border) bg-(--surface-elevated)/50 p-5 space-y-3"
          >
            {renderSectionHeader(
              sec.id,
              sec.label,
              sec.desc,
              <div className="flex items-center gap-2 flex-wrap">
                {sec.visField &&
                  renderVisibilityToggle(storyBible[sec.visField], () =>
                    onUpdateStoryBible({ [sec.visField]: !storyBible[sec.visField] })
                  )}
                {renderAiControls(sec.id, t(sec.label))}
              </div>
            )}
            {openSections[sec.id] && (
              <textarea
                rows={6}
                value={storyBible[sec.id]}
                onChange={(e) => onUpdateStoryBible({ [sec.id]: e.target.value })}
                placeholder={t(sec.ph)}
                aria-label={t(sec.label)}
                className={TEXTAREA_CLS}
              />
            )}
          </section>
        ))}

        {/* 7. Outline */}
        <section
          ref={(el) => {
            sectionRefs.current.outline = el;
          }}
          className="rounded-2xl border border-(--border) bg-(--surface-elevated)/50 p-5 space-y-3.5"
        >
          {renderSectionHeader(
            "outline",
            "novelcrafterOutlineLabel",
            "novelcrafterOutlineDesc",
            renderAiControls("outline", t("novelcrafterOutlineLabel"))
          )}
          {openSections.outline && (
            <div className="space-y-3">
              <div className="rounded-xl border border-(--border) bg-(--surface)/70 p-3 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-(--text-secondary) mr-1">
                    {t("novelcrafterPovLabel")}:
                  </span>
                  {NOVELCRAFTER_POV_OPTIONS.map((pov) => (
                    <button
                      key={pov}
                      type="button"
                      onClick={() => onUpdateStoryBible({ pov })}
                      className={cn(
                        "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                        (storyBible.pov ?? "third_person_limited") === pov
                          ? "bg-(--accent)/15 border-(--accent) text-(--accent) font-semibold"
                          : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                      )}
                    >
                      {t(POV_LABELS[pov])}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-(--text-secondary) mr-1">
                    {t("novelcrafterTenseLabel")}:
                  </span>
                  {NOVELCRAFTER_TENSE_OPTIONS.map((tense) => (
                    <button
                      key={tense}
                      type="button"
                      onClick={() => onUpdateStoryBible({ tense })}
                      className={cn(
                        "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                        (storyBible.tense ?? "past") === tense
                          ? "bg-(--accent)/15 border-(--accent) text-(--accent) font-semibold"
                          : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                      )}
                    >
                      {t(TENSE_LABELS[tense])}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={7}
                value={storyBible.outline}
                onChange={(e) => onUpdateStoryBible({ outline: e.target.value })}
                placeholder={t("novelcrafterOutlinePlaceholder")}
                aria-label={t("novelcrafterOutlineLabel")}
                className={TEXTAREA_CLS}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
