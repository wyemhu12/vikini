// /app/features/novelcrafter/components/StoryBibleSectionCard.tsx
"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, RefreshCw, Wand2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
} from "@/lib/features/novelcrafter/types";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";

export type BibleAiSection = Exclude<NovelcrafterBibleTarget, "scenes" | "draft">;

interface StoryBibleSectionCardProps {
  id: NovelcrafterBibleSectionId;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  isOpen: boolean;
  onToggle: () => void;
  wordCount?: number;
  visibleToAi?: boolean;
  onToggleVisibleToAi?: () => void;
  aiTarget?: BibleAiSection;
  isStreaming?: boolean;
  onRunAiAction?: (
    target: BibleAiSection,
    mode: NovelcrafterActionMode,
    label: string,
    customInstruction?: string
  ) => void;
  children: React.ReactNode;
}

export default function StoryBibleSectionCard({
  id,
  titleKey,
  subtitleKey,
  isOpen,
  onToggle,
  wordCount,
  visibleToAi,
  onToggleVisibleToAi,
  aiTarget,
  isStreaming = false,
  onRunAiAction,
  children,
}: StoryBibleSectionCardProps) {
  const { t } = useLanguage();
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  const handleRun = (mode: NovelcrafterActionMode) => {
    if (!aiTarget || !onRunAiAction) return;
    const label =
      mode === "generate"
        ? `${t("novelcrafterGenerateBtn")}: ${t(titleKey)}`
        : `${t("novelcrafterRewriteBtn")}: ${t(titleKey)}`;
    onRunAiAction(
      aiTarget,
      mode,
      label,
      mode === "rewrite" ? rewriteInstruction.trim() : undefined
    );
    if (mode === "rewrite") setRewriteOpen(false);
  };

  return (
    <section
      id={`bible-section-${id}`}
      className="rounded-2xl border border-(--border) bg-(--surface-elevated)/40 p-4 md:p-5 space-y-4 shadow-xs transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className="text-left flex items-start gap-3 flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-xl py-0.5"
        >
          <span className="mt-0.5 p-1 rounded-lg bg-(--control-bg) text-(--accent) shrink-0">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm md:text-base font-semibold text-(--text-primary)">
              {t(titleKey)}
            </h2>
            <p className="text-xs text-(--text-secondary) leading-relaxed">{t(subtitleKey)}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {typeof wordCount === "number" && (
            <span className="text-xs font-medium text-(--text-secondary) px-2 py-0.5 rounded-full bg-(--control-bg)">
              {t("novelcrafterChapterWordsCount").replace("{count}", wordCount.toLocaleString())}
            </span>
          )}

          {typeof visibleToAi === "boolean" && onToggleVisibleToAi && (
            <button
              type="button"
              aria-pressed={visibleToAi}
              onClick={onToggleVisibleToAi}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
                visibleToAi
                  ? "bg-(--success)/10 border-(--success)/30 text-(--success)"
                  : "bg-(--control-bg) border-(--border) text-(--text-secondary)"
              )}
            >
              {visibleToAi ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>
                {visibleToAi ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")}
              </span>
            </button>
          )}

          {aiTarget && onRunAiAction && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => handleRun("generate")}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold shadow-xs"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>
                  {aiTarget === "outline"
                    ? t("novelcrafterGenerateOutlineCta")
                    : t("novelcrafterGenerateBtn")}
                </span>
              </button>
              <button
                type="button"
                disabled={isStreaming}
                aria-pressed={rewriteOpen}
                onClick={() => setRewriteOpen((p) => !p)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:opacity-50",
                  rewriteOpen
                    ? "bg-(--control-bg-hover) border-(--accent) text-(--accent)"
                    : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t("novelcrafterRewriteBtn")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {rewriteOpen && aiTarget && onRunAiAction && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={rewriteInstruction}
            onChange={(e) => setRewriteInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isStreaming) handleRun("rewrite");
            }}
            placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
            aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
            className="flex-1 min-w-0 h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          />
          <button
            type="button"
            disabled={isStreaming}
            onClick={() => handleRun("rewrite")}
            className="h-8 px-3 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold shrink-0"
          >
            {t("novelcrafterRunAction")}
          </button>
        </div>
      )}

      {isOpen && <div className="pt-2">{children}</div>}
    </section>
  );
}
