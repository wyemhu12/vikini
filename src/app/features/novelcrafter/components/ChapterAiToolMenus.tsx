// /app/features/novelcrafter/components/ChapterAiToolMenus.tsx
"use client";

import React, { useState } from "react";
import { Info, Sparkles, Wand2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import {
  MAX_WRITE_LENGTH_WORDS,
  MIN_WRITE_LENGTH_WORDS,
  NOVELCRAFTER_DESCRIBE_SENSES,
  NOVELCRAFTER_DEVELOPMENTAL_CRITERIA,
  NOVELCRAFTER_FEEDBACK_MODES,
  NOVELCRAFTER_TONE_SHIFTS,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterDescribeSense,
  type NovelcrafterDevelopmentalCriterion,
  type NovelcrafterExpandMode,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterToneShift,
  type NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import { clampWriteLengthWords } from "@/lib/features/novelcrafter/writeLength";
import ChapterAiBrainstormMenu from "./ChapterAiBrainstormMenu";
import {
  DEV_CRITERIA_LABELS,
  FEEDBACK_MODE_LABELS,
  LENGTH_PRESETS,
  SENSE_LABELS,
  TONE_LABELS,
} from "./ChapterAiToolbar";
import PromptSourceTooltip from "./PromptSourceTooltip";

export type ActiveChapterToolMenu =
  | "write"
  | "rewrite"
  | "feedback"
  | "expand"
  | "brainstorm"
  | null;

interface ChapterAiToolMenusProps {
  activeMenu: ActiveChapterToolMenu;
  isStreaming: boolean;
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

const INPUT_CLS =
  "h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

export default function ChapterAiToolMenus({
  activeMenu,
  isStreaming,
  onRunWrite,
  onRunRewrite,
  onRunFeedback,
  onRunExpand,
  onRunBrainstorm,
}: ChapterAiToolMenusProps) {
  const { t } = useLanguage();
  const [guidedDirection, setGuidedDirection] = useState("");
  const [writeLengthWords, setWriteLengthWords] = useState<number>(300);
  const [customLengthDraft, setCustomLengthDraft] = useState<string>("300");
  const [keyDetails, setKeyDetails] = useState("");
  const [customRewritePrompt, setCustomRewritePrompt] = useState("");
  const [feedbackMode, setFeedbackMode] = useState<NovelcrafterFeedbackMode>("developmental");
  const [selectedCriteria, setSelectedCriteria] = useState<NovelcrafterDevelopmentalCriterion[]>([
    ...NOVELCRAFTER_DEVELOPMENTAL_CRITERIA,
  ]);
  const [customFeedbackFocus, setCustomFeedbackFocus] = useState("");
  const [selectedSenses, setSelectedSenses] = useState<NovelcrafterDescribeSense[]>([
    ...NOVELCRAFTER_DESCRIBE_SENSES,
  ]);

  if (!activeMenu) return null;

  const toggleCriterion = (crit: NovelcrafterDevelopmentalCriterion) =>
    setSelectedCriteria((prev) =>
      prev.includes(crit) ? prev.filter((c) => c !== crit) : [...prev, crit]
    );
  const toggleSense = (sense: NovelcrafterDescribeSense) =>
    setSelectedSenses((prev) =>
      prev.includes(sense) ? prev.filter((s) => s !== sense) : [...prev, sense]
    );
  const triggerGuidedWrite = () =>
    onRunWrite({
      mode: "guided",
      writeLengthWords,
      keyDetails: keyDetails.trim() || undefined,
      customInstruction: guidedDirection.trim(),
      subLabel: t("novelcrafterWriteGuided"),
    });

  return (
    <div className="pt-2.5 mt-1 border-t border-(--border) space-y-2.5 max-h-[55dvh] overflow-y-auto custom-scrollbar pr-1">
      {activeMenu === "write" && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
            <Info className="w-3.5 h-3.5 text-(--accent) shrink-0" />
            <span>{t("novelcrafterWriteTooltip")}</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-(--text-secondary) shrink-0">
                {t("novelcrafterWriteLengthLabel")}:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {LENGTH_PRESETS.map((len) => (
                  <button
                    key={len}
                    type="button"
                    aria-pressed={writeLengthWords === len}
                    onClick={() => {
                      setWriteLengthWords(len);
                      setCustomLengthDraft(String(len));
                    }}
                    className={cn(
                      "px-2 py-1 rounded-md border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      writeLengthWords === len
                        ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
                        : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                    )}
                  >
                    ~{len}
                  </button>
                ))}
                <div className="inline-flex items-center gap-1.5 ml-1">
                  <input
                    type="number"
                    min={MIN_WRITE_LENGTH_WORDS}
                    max={MAX_WRITE_LENGTH_WORDS}
                    step={50}
                    inputMode="numeric"
                    value={customLengthDraft}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomLengthDraft(val);
                      if (val.trim()) {
                        setWriteLengthWords(clampWriteLengthWords(val, writeLengthWords));
                      }
                    }}
                    onBlur={() => {
                      const clamped = clampWriteLengthWords(customLengthDraft, writeLengthWords);
                      setWriteLengthWords(clamped);
                      setCustomLengthDraft(String(clamped));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const clamped = clampWriteLengthWords(customLengthDraft, writeLengthWords);
                        setWriteLengthWords(clamped);
                        setCustomLengthDraft(String(clamped));
                      }
                    }}
                    aria-label={t("novelcrafterWriteLengthCustomLabel")}
                    className="w-20 h-7 rounded-md border border-(--control-border) bg-(--control-bg) px-2 text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                  />
                  <span className="text-xs text-(--text-secondary)">
                    {t("novelcrafterWriteLengthCustomHint")}
                  </span>
                </div>
              </div>
            </div>
            <input
              type="text"
              value={keyDetails}
              onChange={(e) => setKeyDetails(e.target.value)}
              placeholder={t("novelcrafterKeyDetailsPlaceholder")}
              aria-label={t("novelcrafterKeyDetailsLabel")}
              className={INPUT_CLS}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <PromptSourceTooltip actionKey="write:auto" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  onRunWrite({
                    mode: "auto",
                    writeLengthWords,
                    keyDetails: keyDetails.trim() || undefined,
                    subLabel: t("novelcrafterWriteAuto"),
                  })
                }
                className="px-3.5 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
              >
                {t("novelcrafterWriteAuto")}
              </button>
            </PromptSourceTooltip>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={guidedDirection}
                onChange={(e) => setGuidedDirection(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && triggerGuidedWrite()}
                placeholder={t("novelcrafterGuidedPromptPlaceholder")}
                aria-label={t("novelcrafterGuidedPromptPlaceholder")}
                className={`flex-1 min-w-0 ${INPUT_CLS}`}
              />
              <PromptSourceTooltip actionKey="write:guided" disabled={isStreaming} side="bottom">
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={triggerGuidedWrite}
                  className="px-3 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
                >
                  {t("novelcrafterWriteGuided")}
                </button>
              </PromptSourceTooltip>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-xs font-semibold text-(--text-secondary) mr-1">
              {t("novelcrafterWriteToneShift")}:
            </span>
            {NOVELCRAFTER_TONE_SHIFTS.map((tone) => (
              <PromptSourceTooltip
                key={tone}
                actionKey="write:tone_shift"
                disabled={isStreaming}
                side="bottom"
              >
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() =>
                    onRunWrite({
                      mode: "tone_shift",
                      toneShift: tone,
                      writeLengthWords,
                      keyDetails: keyDetails.trim() || undefined,
                      subLabel: `${t("novelcrafterWriteToneShift")}: ${t(TONE_LABELS[tone])}`,
                    })
                  }
                  className="px-2.5 py-1 rounded-full border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {t(TONE_LABELS[tone])}
                </button>
              </PromptSourceTooltip>
            ))}
          </div>
        </div>
      )}

      {activeMenu === "rewrite" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
            <Info className="w-3.5 h-3.5 text-(--accent) shrink-0" />
            <span>{t("novelcrafterRewriteTooltip")}</span>
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                ["rephrase", t("novelcrafterRewriteRephrase")],
                ["shorter", t("novelcrafterRewriteShorter")],
                ["more_descriptive", t("novelcrafterRewriteMoreDescriptive")],
                ["show_dont_tell", t("novelcrafterRewriteShowDontTell")],
                ["more_inner_conflict", t("novelcrafterRewriteInnerConflict")],
                ["more_intense", t("novelcrafterRewriteMoreIntense")],
              ] as const
            ).map(([modeKey, modeLabel]) => (
              <PromptSourceTooltip
                key={modeKey}
                actionKey={`rewrite:${modeKey}`}
                disabled={isStreaming}
                side="bottom"
              >
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() => onRunRewrite(modeKey, modeLabel)}
                  className="px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {modeLabel}
                </button>
              </PromptSourceTooltip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customRewritePrompt}
              onChange={(e) => setCustomRewritePrompt(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                onRunRewrite("custom", t("novelcrafterRewriteCustom"), customRewritePrompt)
              }
              placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
              aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
              className={`flex-1 min-w-0 ${INPUT_CLS}`}
            />
            <PromptSourceTooltip actionKey="rewrite:custom" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  onRunRewrite("custom", t("novelcrafterRewriteCustom"), customRewritePrompt)
                }
                className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
              >
                {t("novelcrafterRewriteCustom")}
              </button>
            </PromptSourceTooltip>
          </div>
        </div>
      )}

      {activeMenu === "feedback" && (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
            <Info className="w-3.5 h-3.5 text-(--accent) shrink-0" />
            <span>{t("novelcrafterFeedbackTooltip")}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {NOVELCRAFTER_FEEDBACK_MODES.map((mode) => {
              const info = FEEDBACK_MODE_LABELS[mode];
              return (
                <PromptSourceTooltip key={mode} actionKey={`feedback:${mode}`} side="bottom">
                  <button
                    type="button"
                    onClick={() => setFeedbackMode(mode)}
                    className={cn(
                      "p-2 rounded-xl border text-left transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      feedbackMode === mode
                        ? "bg-(--accent)/15 border-(--accent) text-(--text-primary)"
                        : "bg-(--control-bg) border-(--control-border) text-(--text-secondary) hover:text-(--text-primary)"
                    )}
                  >
                    <p className="text-xs font-bold">{t(info.title)}</p>
                    <p className="text-xs opacity-80 line-clamp-1">{t(info.desc)}</p>
                  </button>
                </PromptSourceTooltip>
              );
            })}
          </div>
          {feedbackMode === "developmental" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {NOVELCRAFTER_DEVELOPMENTAL_CRITERIA.map((crit) => {
                const active = selectedCriteria.includes(crit);
                return (
                  <button
                    key={crit}
                    type="button"
                    onClick={() => toggleCriterion(crit)}
                    aria-pressed={active}
                    className={cn(
                      "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                      active
                        ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
                        : "bg-(--control-bg) border-(--control-border) text-(--text-secondary)"
                    )}
                  >
                    {t(DEV_CRITERIA_LABELS[crit])}
                  </button>
                );
              })}
            </div>
          )}
          {feedbackMode === "custom" && (
            <input
              type="text"
              value={customFeedbackFocus}
              onChange={(e) => setCustomFeedbackFocus(e.target.value)}
              placeholder={t("novelcrafterFeedbackCustomPlaceholder")}
              aria-label={t("novelcrafterFeedbackCustomPlaceholder")}
              className={`w-full ${INPUT_CLS}`}
            />
          )}
          <div className="flex justify-end">
            <PromptSourceTooltip
              actionKey={`feedback:${feedbackMode}`}
              disabled={isStreaming}
              side="bottom"
            >
              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  onRunFeedback({
                    mode: feedbackMode,
                    criteria: feedbackMode === "developmental" ? selectedCriteria : undefined,
                    customInstruction:
                      feedbackMode === "custom" ? customFeedbackFocus.trim() : undefined,
                    subLabel: `${t("novelcrafterSlotFeedback")} · ${t(FEEDBACK_MODE_LABELS[feedbackMode].title)}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {feedbackMode === "developmental"
                    ? t("novelcrafterFeedbackRunDevelopmental")
                    : t("novelcrafterRunAction")}
                </span>
              </button>
            </PromptSourceTooltip>
          </div>
        </div>
      )}

      {activeMenu === "expand" && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
            <Info className="w-3.5 h-3.5 text-(--accent) shrink-0" />
            <span>{t("novelcrafterExpandTooltip")}</span>
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {NOVELCRAFTER_DESCRIBE_SENSES.map((sense) => {
              const active = selectedSenses.includes(sense);
              return (
                <button
                  key={sense}
                  type="button"
                  onClick={() => toggleSense(sense)}
                  aria-pressed={active}
                  className={cn(
                    "px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                    active
                      ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
                      : "bg-(--control-bg) border-(--control-border) text-(--text-secondary)"
                  )}
                >
                  {t(SENSE_LABELS[sense])}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PromptSourceTooltip actionKey="expand:expand" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => onRunExpand("expand", t("novelcrafterExpandPassage"))}
                className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                {t("novelcrafterExpandPassage")}
              </button>
            </PromptSourceTooltip>
            <PromptSourceTooltip actionKey="expand:describe" disabled={isStreaming} side="bottom">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  onRunExpand("describe", t("novelcrafterDescribeAll"), selectedSenses)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Wand2 className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("novelcrafterDescribeAll")}</span>
              </button>
            </PromptSourceTooltip>
          </div>
        </div>
      )}

      {activeMenu === "brainstorm" && (
        <ChapterAiBrainstormMenu isStreaming={isStreaming} onRunBrainstorm={onRunBrainstorm} />
      )}
    </div>
  );
}
