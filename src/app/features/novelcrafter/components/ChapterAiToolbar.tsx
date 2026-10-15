// /app/features/novelcrafter/components/ChapterAiToolbar.tsx
"use client";

import React from "react";
import {
  ChevronDown,
  Expand,
  Lightbulb,
  ListOrdered,
  MessageSquareQuote,
  PenTool,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type {
  NovelcrafterBrainstormCategory,
  NovelcrafterDescribeSense,
  NovelcrafterDevelopmentalCriterion,
  NovelcrafterExpandMode,
  NovelcrafterFeedbackMode,
  NovelcrafterRewriteMode,
  NovelcrafterToneShift,
  NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import ChapterAiToolMenus, { type ActiveChapterToolMenu } from "./ChapterAiToolMenus";

export const TONE_LABELS: Record<NovelcrafterToneShift, TranslationKey> = {
  ominous: "novelcrafterToneOminous",
  whimsical: "novelcrafterToneWhimsical",
  fast_paced: "novelcrafterToneFastPaced",
  intimate: "novelcrafterToneIntimate",
  melancholic: "novelcrafterToneMelancholic",
  suspenseful: "novelcrafterToneSuspenseful",
  humorous: "novelcrafterToneHumorous",
  epic: "novelcrafterToneEpic",
};

export const FEEDBACK_MODE_LABELS: Record<
  NovelcrafterFeedbackMode,
  { title: TranslationKey; desc: TranslationKey }
> = {
  developmental: {
    title: "novelcrafterFeedbackDevelopmental",
    desc: "novelcrafterFeedbackDevelopmentalDesc",
  },
  line_editing: {
    title: "novelcrafterFeedbackLine",
    desc: "novelcrafterFeedbackLineDesc",
  },
  dialogue: {
    title: "novelcrafterFeedbackDialogue",
    desc: "novelcrafterFeedbackDialogueDesc",
  },
  copy_editing: {
    title: "novelcrafterFeedbackCopy",
    desc: "novelcrafterFeedbackCopyDesc",
  },
  beta_read: {
    title: "novelcrafterFeedbackBetaRead",
    desc: "novelcrafterFeedbackBetaReadDesc",
  },
  custom: {
    title: "novelcrafterFeedbackCustom",
    desc: "novelcrafterFeedbackCustomPlaceholder",
  },
};

export const DEV_CRITERIA_LABELS: Record<NovelcrafterDevelopmentalCriterion, TranslationKey> = {
  pacing: "novelcrafterFeedbackCritPacing",
  consistency: "novelcrafterFeedbackCritConsistency",
  believability: "novelcrafterFeedbackCritBelievability",
  clarity: "novelcrafterFeedbackCritClarity",
  originality: "novelcrafterFeedbackCritOriginality",
};

export const SENSE_LABELS: Record<NovelcrafterDescribeSense, TranslationKey> = {
  sight: "novelcrafterSenseSight",
  sound: "novelcrafterSenseSound",
  smell: "novelcrafterSenseSmell",
  taste: "novelcrafterSenseTaste",
  touch: "novelcrafterSenseTouch",
  metaphor: "novelcrafterSenseMetaphor",
};

export const BRAINSTORM_LABELS: Record<NovelcrafterBrainstormCategory, TranslationKey> = {
  plot_twists: "novelcrafterBrainstormTwists",
  character_names: "novelcrafterBrainstormNames",
  world_objects: "novelcrafterBrainstormWorld",
  dialogue: "novelcrafterBrainstormDialogue",
  scene_ideas: "novelcrafterBrainstormScenes",
  characters: "novelcrafterBrainstormCharacters",
  settings: "novelcrafterBrainstormSettings",
  magic_systems: "novelcrafterBrainstormMagic",
  conflicts: "novelcrafterBrainstormConflicts",
  titles: "novelcrafterBrainstormTitles",
};

export const LENGTH_PRESETS = [150, 300, 500, 750] as const;

interface ChapterAiToolbarProps {
  activeMenu: ActiveChapterToolMenu;
  onSelectMenu: (menu: ActiveChapterToolMenu) => void;
  isStreaming: boolean;
  onStopStream: () => void;
  selectedCharCount: number;
  beatsOpen: boolean;
  onToggleBeats: () => void;
  openFeedbackCount: number;
  showFeedbackGutter: boolean;
  onToggleFeedbackGutter: () => void;
  onRunFirstDraft: () => void;
  onRunWrite: (params: {
    mode: NovelcrafterWriteMode;
    toneShift?: NovelcrafterToneShift;
    writeLengthWords?: number;
    keyDetails?: string;
    customInstruction?: string;
    subLabel: string;
  }) => void;
  onRunRewrite: (mode: NovelcrafterRewriteMode, label: string, customInstruction?: string) => void;
  onRunFeedback: (params: {
    mode: NovelcrafterFeedbackMode;
    criteria?: NovelcrafterDevelopmentalCriterion[];
    customInstruction?: string;
    subLabel: string;
  }) => void;
  onRunExpand: (
    mode: NovelcrafterExpandMode,
    label: string,
    senses?: NovelcrafterDescribeSense[]
  ) => void;
  onRunBrainstorm: (
    category: NovelcrafterBrainstormCategory,
    label: string,
    topic?: string
  ) => void;
}

export default function ChapterAiToolbar({
  activeMenu,
  onSelectMenu,
  isStreaming,
  onStopStream,
  selectedCharCount,
  beatsOpen,
  onToggleBeats,
  openFeedbackCount,
  showFeedbackGutter,
  onToggleFeedbackGutter,
  onRunFirstDraft,
  onRunWrite,
  onRunRewrite,
  onRunFeedback,
  onRunExpand,
  onRunBrainstorm,
}: ChapterAiToolbarProps) {
  const { t } = useLanguage();
  const toggleMenu = (menu: Exclude<ActiveChapterToolMenu, null>) =>
    onSelectMenu(activeMenu === menu ? null : menu);

  return (
    <div className="shrink-0 border-b border-(--border) bg-(--surface-muted)/60 backdrop-blur-md px-3 md:px-6 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={isStreaming}
            onClick={onRunFirstDraft}
            title={t("novelcrafterFirstDraftTooltip")}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-(--accent) text-(--accent-foreground) hover:brightness-110 shadow-sm text-xs md:text-[13px] font-semibold transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{t("novelcrafterFirstDraftCtaBtn")}</span>
          </button>

          <button
            type="button"
            aria-pressed={beatsOpen}
            onClick={onToggleBeats}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs md:text-[13px] font-medium transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              beatsOpen
                ? "bg-(--surface-elevated) border-(--control-border) text-(--accent) shadow-xs"
                : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span>{t("novelcrafterChapterBeatsLabel")}</span>
          </button>

          <span className="h-4 w-px bg-(--border) mx-0.5 hidden sm:inline-block" />

          <div className="inline-flex items-center rounded-full border border-(--control-border) bg-(--surface-elevated) shadow-xs overflow-hidden">
            <button
              type="button"
              disabled={isStreaming}
              onClick={() => onRunWrite({ mode: "auto", subLabel: t("novelcrafterWriteAuto") })}
              title={t("novelcrafterWriteTooltip")}
              className="inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <PenTool className="w-3.5 h-3.5 text-(--accent) shrink-0" />
              <span>{t("novelcrafterSlotWrite")}</span>
            </button>
            <button
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === "write"}
              aria-label={t("novelcrafterSlotWrite")}
              onClick={() => toggleMenu("write")}
              className={cn(
                "px-2 py-1.5 border-l border-(--border) transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === "write"
                  ? "bg-(--accent) text-(--accent-foreground)"
                  : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
              )}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {(
            [
              {
                key: "rewrite",
                label: t("novelcrafterSlotRewrite"),
                tip: t("novelcrafterRewriteTooltip"),
                Icon: RefreshCw,
              },
              {
                key: "feedback",
                label: t("novelcrafterSlotFeedback"),
                tip: t("novelcrafterFeedbackTooltip"),
                Icon: MessageSquareQuote,
              },
              {
                key: "expand",
                label: t("novelcrafterSlotExpand"),
                tip: t("novelcrafterExpandTooltip"),
                Icon: Expand,
              },
              {
                key: "brainstorm",
                label: t("novelcrafterSlotBrainstorm"),
                tip: t("novelcrafterBrainstormTooltip"),
                Icon: Lightbulb,
              },
            ] as const
          ).map(({ key, label, tip, Icon }) => (
            <button
              key={key}
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === key}
              onClick={() => toggleMenu(key)}
              title={tip}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs md:text-[13px] font-semibold shadow-xs transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === key
                  ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
                  : "bg-(--surface-elevated) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
              )}
            >
              <Icon className="w-3.5 h-3.5 text-(--accent) shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {selectedCharCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/30 font-medium">
              {t("novelcrafterSelectedChars").replace("{count}", String(selectedCharCount))}
            </span>
          )}

          <button
            type="button"
            aria-pressed={showFeedbackGutter}
            onClick={onToggleFeedbackGutter}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              showFeedbackGutter || openFeedbackCount > 0
                ? "bg-(--accent)/15 border-(--accent)/40 text-(--accent)"
                : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>
              {t("novelcrafterFeedbackOpen")} {openFeedbackCount}
            </span>
          </button>

          {isStreaming && (
            <button
              type="button"
              onClick={onStopStream}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover) text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t("stopBtn")}</span>
            </button>
          )}
        </div>
      </div>

      <ChapterAiToolMenus
        activeMenu={activeMenu}
        isStreaming={isStreaming}
        onRunWrite={onRunWrite}
        onRunRewrite={onRunRewrite}
        onRunFeedback={onRunFeedback}
        onRunExpand={onRunExpand}
        onRunBrainstorm={onRunBrainstorm}
      />
    </div>
  );
}
