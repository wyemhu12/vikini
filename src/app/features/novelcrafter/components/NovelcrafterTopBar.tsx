// /app/features/novelcrafter/components/NovelcrafterTopBar.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Check,
  Crown,
  Loader2,
  PanelLeft,
  PanelRight,
  Settings2,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type {
  ClientGemItem,
  ClientPersonaItem,
  StorySaveStatus,
} from "../hooks/useNovelcrafterStory";

interface NovelcrafterTopBarProps {
  storyTitle: string;
  onRenameTitle: (newTitle: string) => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  allowedModelIds: Set<string>;
  modelsLoading: boolean;
  masterGem: ClientGemItem | null;
  masterPersona: ClientPersonaItem | null;
  saveStatus: StorySaveStatus;
  onOpenRoutingModal: () => void;
  showLeftPane: boolean;
  onToggleLeftPane: () => void;
  showRightPane: boolean;
  onToggleRightPane: () => void;
}

export default function NovelcrafterTopBar({
  storyTitle,
  onRenameTitle,
  selectedModel,
  onSelectModel,
  allowedModelIds,
  modelsLoading,
  masterGem,
  masterPersona,
  saveStatus,
  onOpenRoutingModal,
  showLeftPane,
  onToggleLeftPane,
  showRightPane,
  onToggleRightPane,
}: NovelcrafterTopBarProps) {
  const { t } = useLanguage();
  const [titleDraft, setTitleDraft] = useState(storyTitle);

  useEffect(() => {
    setTitleDraft(storyTitle);
  }, [storyTitle]);

  const handleTitleBlur = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== storyTitle) {
      onRenameTitle(trimmed);
    } else {
      setTitleDraft(storyTitle);
    }
  };

  return (
    <header className="shrink-0 border-b border-(--border) bg-(--surface-muted)/90 backdrop-blur-xl px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20">
      {/* Left: Pane Toggle + Story Title + Save Status */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleLeftPane}
          aria-pressed={showLeftPane}
          aria-label={t("novelcrafterToggleNavigatorPane")}
          className={cn(
            "p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
            showLeftPane
              ? "bg-(--control-bg-hover) border-(--control-border) text-(--accent)"
              : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
          )}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
          <BookOpen className="w-4 h-4 text-(--accent) shrink-0" />
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder={t("novelcrafterStoryTitlePlaceholder")}
            aria-label={t("novelcrafterStoryTitlePlaceholder")}
            className="w-full min-w-0 bg-transparent text-sm md:text-base font-bold text-(--text-primary) placeholder:text-(--text-secondary) rounded-md px-2 py-1 border border-transparent hover:border-(--border) focus:border-(--control-border) focus:bg-(--control-bg) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none transition-colors truncate"
          />
        </div>

        {/* Save status indicator */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-(--border) bg-(--control-bg) text-(--text-secondary) shrink-0">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-(--accent)" />
              <span>{t("novelcrafterSaving")}</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="w-3.5 h-3.5 text-(--success)" />
              <span>{t("novelcrafterSaved")}</span>
            </>
          )}
          {saveStatus === "unsaved" && (
            <>
              <Sparkles className="w-3.5 h-3.5 text-(--warning)" />
              <span>{t("novelcrafterUnsaved")}</span>
            </>
          )}
        </span>
      </div>

      {/* Right: Model Selector + Master GEM Badge + Master Persona Badge + Routing Settings + History Pane Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedModel}
          onChange={(e) => onSelectModel(e.target.value)}
          aria-label={t("selectModel")}
          className="h-9 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) px-2.5 text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none transition-colors max-w-[180px] truncate"
        >
          {SELECTABLE_MODELS.map((m) => {
            const isAllowed =
              modelsLoading || allowedModelIds.size === 0 || allowedModelIds.has(m.id);
            return (
              <option
                key={m.id}
                value={m.id}
                disabled={!isAllowed}
                className="bg-(--surface-elevated) text-(--text-primary)"
              >
                {m.name || m.id}
              </option>
            );
          })}
        </select>

        {/* Master GEM Badge */}
        <button
          type="button"
          onClick={onOpenRoutingModal}
          className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <Crown className="w-3.5 h-3.5 text-(--accent) shrink-0" />
          <span className="text-(--text-secondary)">{t("novelcrafterMasterGemBadge")}:</span>
          <span className="font-semibold truncate max-w-[120px]">
            {masterGem ? masterGem.name : t("novelcrafterNoMasterGem")}
          </span>
        </button>

        {/* Master Persona Badge */}
        <button
          type="button"
          onClick={onOpenRoutingModal}
          className="hidden xl:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <UserCheck className="w-3.5 h-3.5 text-(--accent) shrink-0" />
          <span className="text-(--text-secondary)">{t("novelcrafterMasterPersonaBadge")}:</span>
          <span className="font-semibold truncate max-w-[120px]">
            {masterPersona ? masterPersona.name : t("novelcrafterNoMasterPersona")}
          </span>
        </button>

        {/* Open GEM & Persona Routing Modal */}
        <button
          type="button"
          onClick={onOpenRoutingModal}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{t("novelcrafterRoutingButton")}</span>
        </button>

        {/* Toggle Right History Cards Pane */}
        <button
          type="button"
          onClick={onToggleRightPane}
          aria-pressed={showRightPane}
          aria-label={t("novelcrafterToggleHistoryPane")}
          className={cn(
            "p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
            showRightPane
              ? "bg-(--control-bg-hover) border-(--control-border) text-(--accent)"
              : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
          )}
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
