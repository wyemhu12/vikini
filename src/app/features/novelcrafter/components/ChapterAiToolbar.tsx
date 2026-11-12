// /app/features/novelcrafter/components/ChapterAiToolbar.tsx
"use client";

import React from "react";
import {
  ChevronDown,
  Lightbulb,
  MessageSquareQuote,
  PenTool,
  Sparkles,
  Square,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type ToolbarMenuKey = "write" | "feedback" | "brainstorm";

const FOCUS_RING = "focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

/** Chapter-level AI actions only; selection actions live in the selection bubble (UX cleanup G3). */
export default function ChapterAiToolbar({
  activeMenu,
  onSelectMenu,
  isStreaming,
  onStopStream,
  selectedCharCount,
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

  const menuButtonCls = (key: ToolbarMenuKey, extra?: string) =>
    cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs md:text-[13px] font-semibold transition-colors disabled:opacity-50 shrink-0 whitespace-nowrap",
      FOCUS_RING,
      activeMenu === key
        ? "bg-(--surface) border-(--accent) text-(--accent)"
        : "bg-(--surface) hover:bg-(--raised) border-(--line) text-(--text)",
      extra
    );

  // One Popover per menu button: Radix toggles on re-click and returns focus to the trigger.
  const withMenu = (key: ToolbarMenuKey, trigger: React.ReactElement) => (
    <Popover open={activeMenu === key} onOpenChange={(open) => onSelectMenu(open ? key : null)}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        // Keep focus on the trigger: inner items have focus tooltips that would capture Escape.
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[min(720px,calc(100vw-2rem))] max-w-none p-3"
      >
        <ChapterAiToolMenus
          activeMenu={key}
          isStreaming={isStreaming}
          onRunWrite={onRunWrite}
          onRunRewrite={onRunRewrite}
          onRunFeedback={onRunFeedback}
          onRunExpand={onRunExpand}
          onRunBrainstorm={onRunBrainstorm}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="shrink-0 border-b border-(--line) bg-(--raised)/60 backdrop-blur-md px-3 md:px-6 py-2">
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
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-(--accent) text-(--on-accent) hover:brightness-110 shadow-sm text-xs md:text-[13px] font-semibold transition-all disabled:opacity-50 shrink-0 whitespace-nowrap",
                FOCUS_RING
              )}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t("novelcrafterDraftChapterBtn")}</span>
            </button>
          </PromptSourceTooltip>

          <span className="h-4 w-px bg-(--line) mx-0.5 hidden sm:inline-block shrink-0" />

          <div className="inline-flex items-center rounded-full border border-(--line) bg-(--surface) overflow-hidden shrink-0">
            <PromptSourceTooltip actionKey="write:auto" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => onRunWrite({ mode: "auto", subLabel: t("novelcrafterWriteAuto") })}
                title={t("novelcrafterWriteTooltip")}
                className={cn(
                  "inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-(--text) hover:bg-(--raised) transition-colors disabled:opacity-50 whitespace-nowrap",
                  FOCUS_RING
                )}
              >
                <PenTool className="w-3.5 h-3.5 text-(--accent) shrink-0" />
                <span>{t("novelcrafterSlotWrite")}</span>
              </button>
            </PromptSourceTooltip>
            {withMenu(
              "write",
              <button
                type="button"
                disabled={isStreaming}
                aria-label={t("novelcrafterWriteMenuAria")}
                className={cn(
                  "px-2 py-1.5 border-l transition-colors disabled:opacity-50",
                  FOCUS_RING,
                  activeMenu === "write"
                    ? "border-(--accent) text-(--accent)"
                    : "border-(--line) text-(--muted) hover:text-(--text) hover:bg-(--raised)"
                )}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <PromptSourceTooltip
            actionKey="feedback:developmental"
            disabled={isStreaming || activeMenu === "feedback"}
            side="bottom"
          >
            {withMenu(
              "feedback",
              <button
                type="button"
                disabled={isStreaming}
                title={t("novelcrafterFeedbackTooltip")}
                className={menuButtonCls("feedback")}
              >
                <MessageSquareQuote className="w-3.5 h-3.5 shrink-0 text-(--accent)" />
                <span>{t("novelcrafterSlotFeedback")}</span>
              </button>
            )}
          </PromptSourceTooltip>

          <PromptSourceTooltip
            actionKey="brainstorm:plot_twists"
            disabled={isStreaming || activeMenu === "brainstorm"}
            side="bottom"
          >
            {withMenu(
              "brainstorm",
              <button
                type="button"
                disabled={isStreaming}
                title={t("novelcrafterBrainstormTooltip")}
                className={menuButtonCls("brainstorm")}
              >
                <Lightbulb className="w-3.5 h-3.5 shrink-0 text-(--accent)" />
                <span>{t("novelcrafterSlotBrainstorm")}</span>
              </button>
            )}
          </PromptSourceTooltip>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedCharCount > 0 && (
            <span className="hidden sm:inline-block text-xs px-2.5 py-1 rounded-full border border-(--accent)/30 text-(--accent) font-medium whitespace-nowrap">
              {t("novelcrafterSelectedChars").replace("{count}", String(selectedCharCount))}
            </span>
          )}

          <button
            type="button"
            aria-pressed={showFeedbackGutter}
            onClick={onToggleFeedbackGutter}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap",
              FOCUS_RING,
              showFeedbackGutter || openFeedbackCount > 0
                ? "bg-(--surface) border-(--accent)/60 text-(--accent)"
                : "bg-(--raised) border-(--line) text-(--muted) hover:text-(--text)"
            )}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>
              {t("novelcrafterFeedbackPanelBtn").replace("{count}", String(openFeedbackCount))}
            </span>
          </button>

          {isStreaming && (
            <button
              type="button"
              onClick={onStopStream}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover) text-xs font-semibold transition-colors whitespace-nowrap",
                FOCUS_RING
              )}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t("stopBtn")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
