// /app/features/novelcrafter/components/StoryBibleWorkspace.tsx
"use client";

import React, { useState } from "react";
import { BookOpen, Eye, EyeOff, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
  StoryBible,
} from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";

interface StoryBibleWorkspaceProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
}

type BibleAiSection = Exclude<NovelcrafterBibleTarget, "scenes" | "draft">;

export default function StoryBibleWorkspace({
  storyBible,
  onUpdateStoryBible,
  isStreaming,
  onTriggerStream,
}: StoryBibleWorkspaceProps) {
  const { t } = useLanguage();
  const [rewriteOpenSection, setRewriteOpenSection] = useState<BibleAiSection | null>(null);
  const [rewriteInstructions, setRewriteInstructions] = useState<Record<BibleAiSection, string>>({
    synopsis: "",
    characters: "",
    worldbuilding: "",
    outline: "",
  });

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
    if (actionMode === "rewrite") {
      setRewriteOpenSection(null);
    }
  };

  const renderAiControls = (target: BibleAiSection, titleLabel: string) => {
    const isRewriteOpen = rewriteOpenSection === target;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isStreaming}
            onClick={() =>
              handleRunBibleAction(
                target,
                "generate",
                `${t("novelcrafterGenerateBtn")}: ${titleLabel}`
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{t("novelcrafterGenerateBtn")}</span>
          </button>

          <button
            type="button"
            disabled={isStreaming}
            aria-pressed={isRewriteOpen}
            onClick={() => setRewriteOpenSection(isRewriteOpen ? null : target)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
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
                setRewriteInstructions((prev) => ({
                  ...prev,
                  [target]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isStreaming) {
                  handleRunBibleAction(
                    target,
                    "rewrite",
                    `${t("novelcrafterRewriteBtn")}: ${titleLabel}`
                  );
                }
              }}
              placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
              aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
              className="flex-1 min-w-0 h-9 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
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
              className="h-9 px-3 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
            >
              {t("novelcrafterRunAction")}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-5 custom-scrollbar">
      {/* Header banner */}
      <div className="rounded-2xl border border-(--border) bg-(--surface-muted)/60 p-4 flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-(--control-bg) border border-(--control-border) text-(--accent) shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <h1 className="text-base md:text-lg font-bold text-(--text-primary)">
            {t("novelcrafterStoryBibleTitle")}
          </h1>
          <p className="text-xs md:text-sm text-(--text-secondary)">
            {t("novelcrafterStoryBibleSubtitle")}
          </p>
        </div>
      </div>

      {/* 1. Braindump */}
      <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-2.5">
        <label
          htmlFor="bible-braindump"
          className="flex items-center gap-2 text-sm font-bold text-(--text-primary)"
        >
          <Sparkles className="w-4 h-4 text-(--accent)" />
          <span>{t("novelcrafterBraindumpLabel")}</span>
        </label>
        <textarea
          id="bible-braindump"
          rows={5}
          value={storyBible.braindump}
          onChange={(e) => onUpdateStoryBible({ braindump: e.target.value })}
          placeholder={t("novelcrafterBraindumpPlaceholder")}
          className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />
      </section>

      {/* 2. Genre & 3. Style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-2.5">
          <label htmlFor="bible-genre" className="block text-sm font-bold text-(--text-primary)">
            {t("novelcrafterGenreLabel")}
          </label>
          <textarea
            id="bible-genre"
            rows={3}
            value={storyBible.genre}
            onChange={(e) => onUpdateStoryBible({ genre: e.target.value })}
            placeholder={t("novelcrafterGenrePlaceholder")}
            className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
          />
        </section>

        <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-2.5">
          <label htmlFor="bible-style" className="block text-sm font-bold text-(--text-primary)">
            {t("novelcrafterStyleLabel")}
          </label>
          <textarea
            id="bible-style"
            rows={3}
            value={storyBible.style}
            onChange={(e) => onUpdateStoryBible({ style: e.target.value })}
            placeholder={t("novelcrafterStylePlaceholder")}
            className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
          />
        </section>
      </div>

      {/* 4. Synopsis */}
      <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="bible-synopsis" className="text-sm font-bold text-(--text-primary)">
            {t("novelcrafterSynopsisLabel")}
          </label>
          {renderAiControls("synopsis", t("novelcrafterSynopsisLabel"))}
        </div>
        <textarea
          id="bible-synopsis"
          rows={6}
          value={storyBible.synopsis}
          onChange={(e) => onUpdateStoryBible({ synopsis: e.target.value })}
          placeholder={t("novelcrafterSynopsisPlaceholder")}
          className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />
      </section>

      {/* 5. Characters (with Visibility Toggle) */}
      <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <label htmlFor="bible-characters" className="text-sm font-bold text-(--text-primary)">
              {t("novelcrafterCharactersLabel")}
            </label>
            <button
              type="button"
              aria-pressed={storyBible.charactersVisibleToAI}
              onClick={() =>
                onUpdateStoryBible({
                  charactersVisibleToAI: !storyBible.charactersVisibleToAI,
                })
              }
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                storyBible.charactersVisibleToAI
                  ? "bg-(--success)/10 border-(--success)/30 text-(--success)"
                  : "bg-(--control-bg) border-(--border) text-(--text-secondary)"
              )}
            >
              {storyBible.charactersVisibleToAI ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t("novelcrafterVisibleToAI")}</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t("novelcrafterHiddenFromAI")}</span>
                </>
              )}
            </button>
          </div>
          {renderAiControls("characters", t("novelcrafterCharactersLabel"))}
        </div>
        <textarea
          id="bible-characters"
          rows={6}
          value={storyBible.characters}
          onChange={(e) => onUpdateStoryBible({ characters: e.target.value })}
          placeholder={t("novelcrafterCharactersPlaceholder")}
          className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />
      </section>

      {/* 6. Worldbuilding (with Visibility Toggle) */}
      <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <label
              htmlFor="bible-worldbuilding"
              className="text-sm font-bold text-(--text-primary)"
            >
              {t("novelcrafterWorldbuildingLabel")}
            </label>
            <button
              type="button"
              aria-pressed={storyBible.worldbuildingVisibleToAI}
              onClick={() =>
                onUpdateStoryBible({
                  worldbuildingVisibleToAI: !storyBible.worldbuildingVisibleToAI,
                })
              }
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                storyBible.worldbuildingVisibleToAI
                  ? "bg-(--success)/10 border-(--success)/30 text-(--success)"
                  : "bg-(--control-bg) border-(--border) text-(--text-secondary)"
              )}
            >
              {storyBible.worldbuildingVisibleToAI ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t("novelcrafterVisibleToAI")}</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t("novelcrafterHiddenFromAI")}</span>
                </>
              )}
            </button>
          </div>
          {renderAiControls("worldbuilding", t("novelcrafterWorldbuildingLabel"))}
        </div>
        <textarea
          id="bible-worldbuilding"
          rows={6}
          value={storyBible.worldbuilding}
          onChange={(e) => onUpdateStoryBible({ worldbuilding: e.target.value })}
          placeholder={t("novelcrafterWorldbuildingPlaceholder")}
          className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />
      </section>

      {/* 7. Outline */}
      <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label htmlFor="bible-outline" className="text-sm font-bold text-(--text-primary)">
            {t("novelcrafterOutlineLabel")}
          </label>
          {renderAiControls("outline", t("novelcrafterOutlineLabel"))}
        </div>
        <textarea
          id="bible-outline"
          rows={7}
          value={storyBible.outline}
          onChange={(e) => onUpdateStoryBible({ outline: e.target.value })}
          placeholder={t("novelcrafterOutlinePlaceholder")}
          className="w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
        />
      </section>
    </div>
  );
}
