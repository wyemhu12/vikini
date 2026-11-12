// /app/features/novelcrafter/components/NovelcrafterAiComposer.tsx
"use client";

import React, { useState } from "react";
import { Gem, Square } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import {
  resolveFeatureInheritanceRows,
  type CatalogItemSummary,
} from "@/lib/features/novelcrafter/aiInheritanceTable";
import type { NovelcrafterRoutingConfig } from "@/lib/features/novelcrafter/types";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";

const LENGTH_PILLS: ReadonlyArray<{ words: number; labelKey: TranslationKey }> = [
  { words: 100, labelKey: "novelcrafterComposerLengthSentence" },
  { words: 300, labelKey: "novelcrafterComposerLengthParagraph" },
  { words: 1000, labelKey: "novelcrafterComposerLengthScene" },
];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

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

/**
 * Right-pane free-form AI command box (UX cleanup G3): no selection → guided write,
 * with a selection → custom rewrite of that passage. Preset actions live on the toolbar/bubble.
 */
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
  const [writeLengthWords, setWriteLengthWords] = useState<number>(300);
  const [promptText, setPromptText] = useState("");

  const selection = selectedText?.trim() || "";
  const isRewrite = hasActiveSelection && selection.length > 0;

  const rows = resolveFeatureInheritanceRows({
    routing,
    defaultModelId: selectedModel,
    gems,
    personas,
    allowedModelIds,
  });
  const activeRow = rows.find((r) => r.slot === (isRewrite ? "rewrite" : "write")) ?? rows[0];

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isStreaming) return;
    const text = promptText.trim();

    if (isRewrite) {
      void onTriggerStream({
        feature: "rewrite",
        rewriteMode: "custom",
        selectedText: selection,
        ...(text ? { customInstruction: text } : {}),
        subLabel: t("novelcrafterComposerRewriteLabel"),
      });
      return;
    }

    void onTriggerStream({
      feature: "write",
      writeMode: "guided",
      writeLengthWords,
      ...(text ? { customInstruction: text, keyDetails: text } : {}),
      subLabel: t("novelcrafterComposerWriteLabel"),
    });
  };

  return (
    <form
      aria-label={t("novelcrafterComposerFormAria")}
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-(--line) bg-(--surface) p-3.5 flex flex-col gap-2.5"
    >
      <label className="flex">
        <span className="sr-only">{t("novelcrafterComposerPromptAria")}</span>
        <textarea
          rows={3}
          aria-label={t("novelcrafterComposerPromptAria")}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={t("novelcrafterComposerFreeformPlaceholder")}
          className={cn(
            "w-full resize-none rounded-xl border border-(--line) bg-(--bg) px-2.5 py-2 text-sm leading-snug text-(--text) placeholder:text-(--faint)",
            FOCUS_RING
          )}
        />
      </label>

      {!isRewrite && (
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
                  "h-6.5 rounded-md border px-2 text-xs transition-colors",
                  FOCUS_RING,
                  active
                    ? "border-(--accent) bg-transparent font-semibold text-(--accent)"
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
        className={cn(
          "flex h-7.5 items-center gap-1.5 rounded-lg border border-dashed border-(--line) px-2 text-left text-xs text-(--muted) transition-colors hover:border-(--accent) hover:text-(--text)",
          FOCUS_RING
        )}
      >
        <Gem aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-(--accent)" />
        <span className="flex-1 truncate">{promptSourceLabel}</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenAiSettings?.()}
          className={cn(
            "h-10 max-w-[150px] truncate rounded-xl border border-(--line) bg-transparent px-2.5 text-xs font-medium text-(--text) transition-colors hover:bg-(--raised)",
            FOCUS_RING
          )}
        >
          {activeRow.effectiveModelName}
        </button>

        {isStreaming ? (
          <button
            type="button"
            onClick={onStopStream}
            className={cn(
              "flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-(--danger) px-3 text-sm font-semibold text-(--danger-foreground) transition-colors hover:bg-(--danger-hover)",
              FOCUS_RING
            )}
          >
            <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            <span>{t("stopBtn")}</span>
          </button>
        ) : (
          <button
            type="submit"
            className={cn(
              "flex-1 h-10 rounded-xl border border-(--accent) bg-transparent px-3 text-sm font-semibold text-(--accent) transition-colors hover:bg-(--raised)",
              FOCUS_RING
            )}
          >
            {isRewrite ? t("novelcrafterComposerRewriteLabel") : t("novelcrafterComposerSendBtn")}
          </button>
        )}
      </div>
    </form>
  );
}
