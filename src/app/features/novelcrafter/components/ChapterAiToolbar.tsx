// /app/features/novelcrafter/components/ChapterAiToolbar.tsx
"use client";

import React from "react";
import {
  ChevronDown,
  Expand,
  Lightbulb,
  ListOrdered,
  MessageSquareQuote,
  MoreHorizontal,
  PenTool,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  NOVELCRAFTER_WRITE_LENGTH_OPTIONS,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterDescribeSense,
  type NovelcrafterDevelopmentalCriterion,
  type NovelcrafterExpandMode,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterToneShift,
  type NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import ChapterAiToolMenus, { type ActiveChapterToolMenu } from "./ChapterAiToolMenus";
import PromptSourceTooltip from "./PromptSourceTooltip";

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

export const LENGTH_PRESETS = NOVELCRAFTER_WRITE_LENGTH_OPTIONS;

export interface ChapterAiToolbarProps {
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

  const secondaryTools: ReadonlyArray<{
    key: Exclude<ActiveChapterToolMenu, "write" | null>;
    actionKey: NovelcrafterPromptActionKey;
    label: string;
    tip: string;
    Icon: typeof RefreshCw;
  }> = [
    {
      key: "rewrite",
      actionKey: "rewrite:rephrase",
      label: t("novelcrafterSlotRewrite"),
      tip: t("novelcrafterRewriteTooltip"),
      Icon: RefreshCw,
    },
    {
      key: "feedback",
      actionKey: "feedback:developmental",
      label: t("novelcrafterSlotFeedback"),
      tip: t("novelcrafterFeedbackTooltip"),
      Icon: MessageSquareQuote,
    },
    {
      key: "expand",
      actionKey: "expand:expand",
      label: t("novelcrafterSlotExpand"),
      tip: t("novelcrafterExpandTooltip"),
      Icon: Expand,
    },
    {
      key: "brainstorm",
      actionKey: "brainstorm:plot_twists",
      label: t("novelcrafterSlotBrainstorm"),
      tip: t("novelcrafterBrainstormTooltip"),
      Icon: Lightbulb,
    },
  ];

  const renderToolBtn = ({
    key,
    actionKey,
    label,
    tip,
    Icon,
    extraClass,
  }: (typeof secondaryTools)[number] & { extraClass?: string }) => (
    <PromptSourceTooltip key={key} actionKey={actionKey} disabled={isStreaming} side="bottom">
      <button
        type="button"
        disabled={isStreaming}
        aria-pressed={activeMenu === key}
        onClick={() => toggleMenu(key)}
        title={tip}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs md:text-[13px] font-semibold shadow-xs transition-all disabled:opacity-50 shrink-0 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
          activeMenu === key
            ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
            : "bg-(--surface-elevated) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)",
          extraClass
        )}
      >
        <Icon
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            activeMenu === key ? "text-(--accent-foreground)" : "text-(--accent)"
          )}
        />
        <span>{label}</span>
      </button>
    </PromptSourceTooltip>
  );

  return (
    <div className="shrink-0 border-b border-(--border) bg-(--surface-muted)/60 backdrop-blur-md px-3 md:px-6 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-nowrap overflow-hidden">
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto [scrollbar-width:none] min-w-0">
          <PromptSourceTooltip
            actionKey="bible:draft"
            actionMode="generate"
            disabled={isStreaming}
            side="bottom"
          >
            <button
              type="button"
              disabled={isStreaming}
              onClick={onRunFirstDraft}
              title={t("novelcrafterFirstDraftTooltip")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-(--accent) text-(--accent-foreground) hover:brightness-110 shadow-sm text-xs md:text-[13px] font-semibold transition-all disabled:opacity-50 shrink-0 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t("novelcrafterFirstDraftCtaBtn")}</span>
            </button>
          </PromptSourceTooltip>

          <button
            type="button"
            aria-pressed={beatsOpen}
            onClick={onToggleBeats}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs md:text-[13px] font-medium transition-all shrink-0 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              beatsOpen
                ? "bg-(--surface-elevated) border-(--control-border) text-(--accent) shadow-xs"
                : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span>{t("novelcrafterChapterBeatsLabel")}</span>
          </button>

          <span className="h-4 w-px bg-(--border) mx-0.5 hidden sm:inline-block shrink-0" />

          <div className="inline-flex items-center rounded-full border border-(--control-border) bg-(--surface-elevated) shadow-xs overflow-hidden shrink-0">
            <PromptSourceTooltip actionKey="write:auto" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => onRunWrite({ mode: "auto", subLabel: t("novelcrafterWriteAuto") })}
                title={t("novelcrafterWriteTooltip")}
                className="inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors disabled:opacity-50 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              >
                <PenTool className="w-3.5 h-3.5 text-(--accent) shrink-0" />
                <span>{t("novelcrafterSlotWrite")}</span>
              </button>
            </PromptSourceTooltip>
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

          <span className="h-4 w-px bg-(--border) mx-0.5 hidden lg:inline-block shrink-0" />

          {/* Rewrite & Feedback visible on lg+ */}
          {renderToolBtn({ ...secondaryTools[0], extraClass: "hidden lg:inline-flex" })}
          {renderToolBtn({ ...secondaryTools[1], extraClass: "hidden lg:inline-flex" })}

          {/* Expand & Brainstorm visible on xl+ */}
          {renderToolBtn({ ...secondaryTools[2], extraClass: "hidden xl:inline-flex" })}
          {renderToolBtn({ ...secondaryTools[3], extraClass: "hidden xl:inline-flex" })}

          {/* Overflow DropdownMenu for <xl (shows all 4 on <lg, or Expand+Brainstorm on lg..xl) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isStreaming}
                className="xl:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) shrink-0 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("novelcrafterMoreToolsBtn")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {secondaryTools.map(({ key, label, Icon }, idx) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => toggleMenu(key)}
                  className={cn("gap-2", idx < 2 && "lg:hidden")}
                >
                  <Icon className="w-3.5 h-3.5 text-(--accent)" />
                  <span>{label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedCharCount > 0 && (
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/30 font-medium whitespace-nowrap">
              {t("novelcrafterSelectedChars").replace("{count}", String(selectedCharCount))}
            </span>
          )}

          <button
            type="button"
            aria-pressed={showFeedbackGutter}
            onClick={onToggleFeedbackGutter}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover) text-xs font-semibold transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
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
