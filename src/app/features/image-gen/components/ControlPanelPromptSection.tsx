// /app/features/image-gen/components/ControlPanelPromptSection.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Ban, Clock, Lightbulb, Sparkles, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import PromptBuilder from "./PromptBuilder";
import { usePromptAutocomplete } from "./hooks/usePromptAutocomplete";

/** Section label style shared by the Studio control panel (sentence case, no tracking). */
export const STUDIO_LABEL_CLASS = "text-sm font-semibold text-(--text)";

// Suggestion tags for quick keyword insertion - 3 categories
const SUGGESTION_TAGS = [
  // Style
  "studioTagCinematicLighting",
  "studioTagBokeh",
  "studioTagGoldenHour",
  "studioTagDramaticShadows",
  // Color
  "studioTagVibrantColors",
  "studioTagPastelTones",
  "studioTagMonochrome",
  "studioTagNeonGlow",
  // Composition
  "studioTagCloseUp",
  "studioTagWideAngle",
  "studioTagBirdsEye",
  "studioTagMinimalist",
] as const;

export interface ControlPanelPromptSectionProps {
  prompt: string;
  setPrompt: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  promptHistory: string[];
  onClearHistory: () => void;
  /** Rendered at the end of the "Prompt" label row (e.g. the Studio settings button). */
  headerAction?: React.ReactNode;
  /** Rendered right under the prompt input (e.g. the "enrich prompt" switch). */
  children?: React.ReactNode;
}

/** Prompt block of the Image Studio: Free/Guided modes, autocomplete, quick tags, exclude, history. */
export default function ControlPanelPromptSection({
  prompt,
  setPrompt,
  model,
  setModel,
  generating,
  onGenerate,
  negativePrompt,
  setNegativePrompt,
  promptHistory,
  onClearHistory,
  headerAction,
  children,
}: ControlPanelPromptSectionProps) {
  const { t } = useLanguage();
  const [promptMode, setPromptMode] = useState<"free" | "guided">("free");
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const autocomplete = usePromptAutocomplete({ prompt, setPrompt, generating, onGenerate });

  return (
    <div className="space-y-2 px-4 md:px-6">
      <div className="flex items-center justify-between gap-2">
        <Label className={STUDIO_LABEL_CLASS}>{t("studioPromptLabel")}</Label>
        {headerAction}
      </div>

      {/* MT4: Mode tabs - Free / Guided (segment control with sliding indicator) */}
      <div className="relative flex items-center rounded-lg bg-(--raised) border border-(--line) p-0.5">
        <motion.div
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded-md shadow-sm",
            promptMode === "free"
              ? "bg-(--surface) border border-(--line)"
              : "bg-(--soft) border border-(--accent)"
          )}
          layoutId="prompt-mode-indicator"
          style={{
            width: "calc(50% - 2px)",
            left: promptMode === "free" ? "2px" : "calc(50%)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        <button
          type="button"
          aria-pressed={promptMode === "free"}
          onClick={() => setPromptMode("free")}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-200",
            promptMode === "free" ? "text-(--text)" : "text-(--muted) hover:text-(--text)"
          )}
        >
          {t("pbModeFree")}
        </button>
        <button
          type="button"
          aria-pressed={promptMode === "guided"}
          onClick={() => setPromptMode("guided")}
          className={cn(
            "relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-200",
            promptMode === "guided" ? "text-(--accent)" : "text-(--muted) hover:text-(--text)"
          )}
        >
          {t("pbModeGuided")}
        </button>
      </div>

      {promptMode === "guided" ? (
        <>
          <PromptBuilder
            onBuildPrompt={(built) => {
              setPrompt(built);
              setPromptMode("free");
            }}
          />
          {children}
        </>
      ) : (
        <>
          <div className="relative">
            <Textarea
              placeholder={t("studioPromptPlaceholder")}
              aria-label={t("studioPromptLabel")}
              className="h-32 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1"
              value={prompt}
              onChange={(e) => autocomplete.handlePromptChange(e.target.value)}
              onKeyDown={autocomplete.handlePromptKeyDown}
              onBlur={autocomplete.dismissSuggestions}
            />
            {/* AI Autocomplete Suggestions */}
            {autocomplete.showSuggestions && autocomplete.suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-(--surface) border border-(--line) rounded-lg shadow-xl overflow-hidden">
                {autocomplete.loadingSuggestions && (
                  <div className="px-3 py-2 text-xs text-(--muted) animate-pulse">
                    {t("studioSuggestLoading")}
                  </div>
                )}
                {autocomplete.suggestions.map((s, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      autocomplete.selectSuggestion(s);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 text-xs transition-colors border-b border-(--line) last:border-b-0",
                      idx === autocomplete.selectedSuggestionIdx
                        ? "bg-(--soft) text-(--accent)"
                        : "hover:bg-(--raised) text-(--text)"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {children}

          {/* Suggestion Tags - click to append keyword */}
          <div className="space-y-1.5 pt-2">
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-(--accent) cursor-help"
              title={t("studioQuickAddTooltip")}
            >
              <Sparkles aria-hidden="true" className="w-3 h-3" />
              {t("studioQuickAddLabel")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTION_TAGS.map((tagKey) => (
                <button
                  type="button"
                  key={tagKey}
                  onClick={() => {
                    const separator = prompt.trim() ? ", " : "";
                    setPrompt(prompt.trim() + separator + t(tagKey));
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-(--line) bg-(--raised) hover:bg-(--soft) hover:border-(--accent) text-(--muted) hover:text-(--text) transition-colors"
                >
                  {t(tagKey)}
                </button>
              ))}
            </div>
          </div>

          {/* QW1: Negative Prompt (collapsible) */}
          <div className="pt-2">
            <button
              type="button"
              aria-expanded={showNegativePrompt}
              onClick={() => setShowNegativePrompt(!showNegativePrompt)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-(--danger)/10 border border-(--danger)/30 text-(--danger) hover:bg-(--danger)/15 transition-colors"
              title={t("studioExcludeTooltip")}
            >
              <Ban aria-hidden="true" className="w-3 h-3" />
              {t("studioExcludeLabel")}
              {negativePrompt && (
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-(--danger)" />
              )}
            </button>
            {showNegativePrompt && (
              <Textarea
                placeholder={t("studioNegativePromptPlaceholder")}
                aria-label={t("studioExcludeLabel")}
                className="mt-1.5 h-16 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1 text-xs"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
              />
            )}
          </div>

          {/* QW7: Text Rendering Tip */}
          {prompt.match(/["'].+?["']/) && model.includes("flash-image") && (
            <button
              type="button"
              onClick={() => setModel("gemini-3-pro-image")}
              className="flex items-center gap-2 p-2 rounded-lg bg-(--warning)/10 border border-(--warning)/30 text-xs text-(--warning) font-medium hover:bg-(--warning)/15 transition-colors w-full text-left"
            >
              <Lightbulb aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{t("studioTextRenderingTip")}</span>
            </button>
          )}

          {/* QW5: Prompt History */}
          {promptHistory.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-expanded={showHistory}
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-(--raised) border border-(--line) text-(--muted) hover:text-(--text) transition-colors"
                  title={t("studioHistoryTooltip")}
                >
                  <Clock aria-hidden="true" className="w-3 h-3" />
                  {t("studioPromptHistory")}
                  <span className="text-xs font-normal">({promptHistory.length})</span>
                </button>
                {showHistory && (
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="text-xs text-(--danger) hover:opacity-80 transition-opacity flex items-center gap-1"
                  >
                    <Trash2 aria-hidden="true" className="w-3 h-3" />
                    {t("studioClearHistory")}
                  </button>
                )}
              </div>
              {showHistory && (
                <div className="mt-1.5 flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {promptHistory.slice(0, 10).map((hp, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setPrompt(hp)}
                      className="text-left text-xs text-(--muted) hover:text-(--text) hover:bg-(--raised) px-2 py-1.5 rounded-md transition-colors truncate"
                      title={hp}
                    >
                      {hp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
