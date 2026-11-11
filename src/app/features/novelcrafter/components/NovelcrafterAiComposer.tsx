// /app/features/novelcrafter/components/NovelcrafterAiComposer.tsx
"use client";

import React, { useState } from "react";
import { Gem, Square } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import {
  resolveFeatureInheritanceRows,
  type CatalogItemSummary,
} from "@/lib/features/novelcrafter/aiInheritanceTable";
import {
  NOVELCRAFTER_TONE_SHIFTS,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterExpandMode,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterRoutingConfig,
  type NovelcrafterToneShift,
  type NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import { TONE_LABELS } from "./ChapterAiToolbar";

type ComposerActionGroup = "write" | "rewrite" | "expand" | "feedback" | "brainstorm";

const WRITE_MODES: ReadonlyArray<{ id: NovelcrafterWriteMode; labelKey: TranslationKey }> = [
  { id: "auto", labelKey: "novelcrafterWriteAuto" },
  { id: "guided", labelKey: "novelcrafterWriteGuided" },
  { id: "tone_shift", labelKey: "novelcrafterWriteToneShift" },
];

const REWRITE_MODES: ReadonlyArray<{ id: NovelcrafterRewriteMode; labelKey: TranslationKey }> = [
  { id: "rephrase", labelKey: "novelcrafterRewriteRephrase" },
  { id: "shorter", labelKey: "novelcrafterRewriteShorter" },
  { id: "custom", labelKey: "novelcrafterRewriteCustom" },
];

const EXPAND_MODES: ReadonlyArray<{ id: NovelcrafterExpandMode; labelKey: TranslationKey }> = [
  { id: "expand", labelKey: "novelcrafterSlotExpand" },
  { id: "describe", labelKey: "novelcrafterDescribeAll" },
];

const FEEDBACK_MODES: ReadonlyArray<{ id: NovelcrafterFeedbackMode; labelKey: TranslationKey }> = [
  { id: "developmental", labelKey: "novelcrafterFeedbackDevelopmental" },
  { id: "line_editing", labelKey: "novelcrafterFeedbackLine" },
  { id: "custom", labelKey: "novelcrafterFeedbackCustom" },
];

const BRAINSTORM_MODES: ReadonlyArray<{
  id: NovelcrafterBrainstormCategory;
  labelKey: TranslationKey;
}> = [
  { id: "plot_twists", labelKey: "novelcrafterBrainstormTwists" },
  { id: "scene_ideas", labelKey: "novelcrafterBrainstormScenes" },
  { id: "dialogue", labelKey: "novelcrafterBrainstormDialogue" },
];

const LENGTH_PILLS: ReadonlyArray<{ words: number; labelKey: TranslationKey }> = [
  { words: 100, labelKey: "novelcrafterComposerLengthSentence" },
  { words: 300, labelKey: "novelcrafterComposerLengthParagraph" },
  { words: 1000, labelKey: "novelcrafterComposerLengthScene" },
];

export interface NovelcrafterAiComposerProps {
  isStreaming: boolean;
  hasActiveSelection: boolean;
  selectedText?: string;
  selectedModel: string;
  allowedModelIds?: ReadonlySet<string>;
  routing: NovelcrafterRoutingConfig;
  gems: readonly CatalogItemSummary[];
  personas: readonly CatalogItemSummary[];
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void> | void;
  onStopStream: () => void;
  onOpenAiSettings?: () => void;
}

/** Right-pane docked AI command composer matching Novel.dc.html (Vikini 3.0 phase 5E). */
export default function NovelcrafterAiComposer({
  isStreaming,
  hasActiveSelection,
  selectedText,
  selectedModel,
  allowedModelIds,
  routing,
  gems,
  personas,
  onTriggerStream,
  onStopStream,
  onOpenAiSettings,
}: NovelcrafterAiComposerProps) {
  const { t } = useLanguage();
  const [action, setAction] = useState<ComposerActionGroup>("write");
  const [writeMode, setWriteMode] = useState<NovelcrafterWriteMode>("auto");
  const [toneShift, setToneShift] = useState<NovelcrafterToneShift>("melancholic");
  const [writeLengthWords, setWriteLengthWords] = useState<number>(300);
  const [rewriteMode, setRewriteMode] = useState<NovelcrafterRewriteMode>("rephrase");
  const [expandMode, setExpandMode] = useState<NovelcrafterExpandMode>("expand");
  const [feedbackMode, setFeedbackMode] = useState<NovelcrafterFeedbackMode>("developmental");
  const [brainstormCategory, setBrainstormCategory] =
    useState<NovelcrafterBrainstormCategory>("plot_twists");
  const [promptText, setPromptText] = useState("");

  const rows = resolveFeatureInheritanceRows({
    routing,
    defaultModelId: selectedModel,
    gems,
    personas,
    allowedModelIds,
  });
  const activeRow = rows.find((r) => r.slot === action) ?? rows[0];

  const gemSummary = activeRow.masterGemName || t("novelcrafterComposerNoneShort");
  const personaSummary =
    activeRow.personaSource === "disabled"
      ? t("novelcrafterDisablePersonaShort")
      : activeRow.personaSource === "override"
        ? activeRow.effectivePersonaName || t("novelcrafterComposerNoneShort")
        : activeRow.effectivePersonaName || t("novelcrafterInheritShort");
  const promptSourceLabel = t("novelcrafterComposerPromptSourceSummary")
    .replace("{gem}", gemSummary)
    .replace("{persona}", personaSummary);

  const actionOptions: ReadonlyArray<{ id: ComposerActionGroup; label: string }> = [
    { id: "write", label: t("novelcrafterSlotWrite") },
    { id: "rewrite", label: t("novelcrafterSlotRewrite") },
    { id: "expand", label: t("novelcrafterSlotExpand") },
    { id: "feedback", label: t("novelcrafterSlotFeedback") },
    { id: "brainstorm", label: t("novelcrafterSlotBrainstorm") },
  ];

  const currentModes =
    action === "write"
      ? WRITE_MODES.map((m) => ({
          id: m.id,
          label: t(m.labelKey),
          checked: writeMode === m.id,
          select: () => setWriteMode(m.id),
        }))
      : action === "rewrite"
        ? REWRITE_MODES.map((m) => ({
            id: m.id,
            label: t(m.labelKey),
            checked: rewriteMode === m.id,
            select: () => setRewriteMode(m.id),
          }))
        : action === "expand"
          ? EXPAND_MODES.map((m) => ({
              id: m.id,
              label: t(m.labelKey),
              checked: expandMode === m.id,
              select: () => setExpandMode(m.id),
            }))
          : action === "feedback"
            ? FEEDBACK_MODES.map((m) => ({
                id: m.id,
                label: t(m.labelKey),
                checked: feedbackMode === m.id,
                select: () => setFeedbackMode(m.id),
              }))
            : BRAINSTORM_MODES.map((m) => ({
                id: m.id,
                label: t(m.labelKey),
                checked: brainstormCategory === m.id,
                select: () => setBrainstormCategory(m.id),
              }));

  const submitLabel =
    actionOptions.find((opt) => opt.id === action)?.label || t("novelcrafterSlotWrite");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isStreaming) return;

    const trimmed = promptText.trim();
    const activeModeLabel = currentModes.find((m) => m.checked)?.label || submitLabel;

    if (action === "write") {
      void onTriggerStream({
        feature: "write",
        writeMode,
        writeLengthWords,
        ...(writeMode === "tone_shift" ? { toneShift } : {}),
        ...(trimmed ? { keyDetails: trimmed, customInstruction: trimmed } : {}),
        subLabel: `${submitLabel} · ${activeModeLabel}`,
      });
      return;
    }

    if (action === "rewrite" || action === "expand") {
      const sel = selectedText?.trim() || "";
      if (!hasActiveSelection && !sel) {
        toast.info(t("novelcrafterSelectTextHint"));
        return;
      }
      if (action === "rewrite") {
        void onTriggerStream({
          feature: "rewrite",
          rewriteMode,
          selectedText: sel || undefined,
          ...(trimmed ? { customInstruction: trimmed } : {}),
          subLabel: `${submitLabel} · ${activeModeLabel}`,
        });
      } else {
        void onTriggerStream({
          feature: "expand",
          expandMode,
          selectedText: sel || undefined,
          ...(trimmed ? { customInstruction: trimmed } : {}),
          subLabel: `${submitLabel} · ${activeModeLabel}`,
        });
      }
      return;
    }

    if (action === "feedback") {
      void onTriggerStream({
        feature: "feedback",
        feedbackMode,
        ...(trimmed ? { customInstruction: trimmed } : {}),
        subLabel: `${submitLabel} · ${activeModeLabel}`,
      });
      return;
    }

    void onTriggerStream({
      feature: "brainstorm",
      brainstormCategory,
      ...(trimmed ? { customInstruction: trimmed } : {}),
      subLabel: `${submitLabel} · ${activeModeLabel}`,
    });
  };

  return (
    <form
      aria-label={t("novelcrafterComposerFormAria")}
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-(--line) bg-(--surface) p-3.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-1.5">
        <select
          aria-label={t("novelcrafterComposerActionAria")}
          value={action}
          onChange={(e) => setAction(e.target.value as ComposerActionGroup)}
          className="h-8.5 rounded-lg border border-(--line) bg-(--bg) px-2 text-xs font-semibold text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {actionOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <div
          role="radiogroup"
          aria-label={t("novelcrafterComposerModeGroupAria")}
          className={cn(
            "flex-1 min-w-0 grid gap-0.5 rounded-lg bg-(--raised) p-0.5",
            currentModes.length === 2 ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {currentModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={mode.checked}
              onClick={mode.select}
              className={cn(
                "h-7 rounded-md px-1.5 text-xs truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                mode.checked
                  ? "bg-(--surface) font-semibold text-(--text)"
                  : "bg-transparent font-medium text-(--muted) hover:text-(--text)"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {action === "write" && writeMode === "tone_shift" && (
        <select
          aria-label={t("novelcrafterWriteToneShift")}
          value={toneShift}
          onChange={(e) => setToneShift(e.target.value as NovelcrafterToneShift)}
          className="h-8 rounded-lg border border-(--line) bg-(--bg) px-2.5 text-xs text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {NOVELCRAFTER_TONE_SHIFTS.map((tone) => (
            <option key={tone} value={tone}>
              {t(TONE_LABELS[tone])}
            </option>
          ))}
        </select>
      )}

      <label className="flex">
        <span className="sr-only">{t("novelcrafterComposerPromptAria")}</span>
        <textarea
          rows={2}
          aria-label={t("novelcrafterComposerPromptAria")}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={t("novelcrafterComposerPromptPlaceholder")}
          className="w-full resize-none rounded-xl border border-(--line) bg-(--bg) px-2.5 py-2 text-sm leading-snug text-(--text) placeholder:text-(--faint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        />
      </label>

      {action === "write" && (
        <div className="flex items-center gap-1.5 text-xs text-(--faint)">
          <span>{t("novelcrafterWriteLengthLabel")}</span>
          {LENGTH_PILLS.map((pill) => {
            const active = writeLengthWords === pill.words;
            return (
              <button
                key={pill.words}
                type="button"
                aria-pressed={active}
                onClick={() => setWriteLengthWords(pill.words)}
                className={cn(
                  "h-6.5 rounded-md border px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                  active
                    ? "border-(--accent) bg-(--soft) font-semibold text-(--accent)"
                    : "border-(--line) bg-transparent font-medium text-(--muted) hover:text-(--text)"
                )}
              >
                {t(pill.labelKey)}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        aria-label={t("novelcrafterComposerPromptSourceAria")}
        onClick={() => onOpenAiSettings?.()}
        className="flex h-7.5 items-center gap-1.5 rounded-lg border border-dashed border-(--line) px-2 text-left text-xs text-(--muted) transition-colors hover:border-(--accent) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <Gem aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-(--accent)" />
        <span className="flex-1 truncate">{promptSourceLabel}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenAiSettings?.()}
          className="h-10 max-w-[150px] truncate rounded-xl border border-(--line) bg-transparent px-2.5 text-xs font-medium text-(--text) transition-colors hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {activeRow.effectiveModelName}
        </button>

        {isStreaming ? (
          <button
            type="button"
            onClick={onStopStream}
            className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-(--accent) px-3 text-sm font-semibold text-(--on-accent) transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            <span>{t("stopBtn")}</span>
          </button>
        ) : (
          <button
            type="submit"
            className="flex-1 h-10 rounded-xl bg-(--accent) px-3 text-sm font-semibold text-(--on-accent) transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
