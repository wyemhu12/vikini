// /app/features/novelcrafter/components/NovelcrafterTopBar.tsx
"use client";

import React, { useState, useEffect, useId } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  Menu,
  PanelLeft,
  PanelRight,
  Settings2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModelSelector from "@/app/features/chat/components/ModelSelector";
import { isModelAllowedById } from "@/lib/core/modelAccess";
import { useLanguage } from "../../chat/hooks/useLanguage";
import NovelcrafterTopBarMenu from "./NovelcrafterTopBarMenu";
import { cn } from "@/lib/utils/cn";
import type {
  ClientGemItem,
  ClientPersonaItem,
  StorySaveStatus,
} from "../hooks/useNovelcrafterStory";

interface NovelcrafterTopBarProps {
  storyTitle: string;
  onRenameTitle: (newTitle: string) => void;
  viewTabs?: React.ReactNode;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  allowedModelIds: Set<string>;
  masterGem: ClientGemItem | null;
  masterPersona: ClientPersonaItem | null;
  saveStatus: StorySaveStatus;
  chapterWordCount: number;
  historyCount?: number;
  onRetrySave: () => void;
  onOpenRoutingModal: () => void;
  onExportManuscript?: (options: {
    format: "md" | "txt";
    includeStoryBible: boolean;
    includeChapterSummaries: boolean;
  }) => void;
  showLeftPane: boolean;
  onToggleLeftPane: () => void;
  showRightPane: boolean;
  onToggleRightPane: () => void;
  renamingStoryId?: string | null;
  renameStoryTitle?: string;
  onChangeRenameStoryTitle?: (val: string) => void;
  onCloseRenameStoryModal?: () => void;
  onConfirmRenameStory?: () => void;
  /** Compact two-row layout below 768px (no app header on the Studio page). */
  isMobileLayout?: boolean;
  onOpenSidebar?: () => void;
}

export default function NovelcrafterTopBar({
  storyTitle,
  onRenameTitle,
  viewTabs,
  selectedModel,
  onSelectModel,
  allowedModelIds,
  masterGem,
  masterPersona,
  saveStatus,
  chapterWordCount,
  historyCount = 0,
  onRetrySave,
  onOpenRoutingModal,
  onExportManuscript,
  showLeftPane,
  onToggleLeftPane,
  showRightPane,
  onToggleRightPane,
  renamingStoryId,
  renameStoryTitle = "",
  onChangeRenameStoryTitle,
  onCloseRenameStoryModal,
  onConfirmRenameStory,
  isMobileLayout = false,
  onOpenSidebar,
}: NovelcrafterTopBarProps) {
  const { t } = useLanguage();
  const [titleDraft, setTitleDraft] = useState(storyTitle);
  const aiSummaryId = useId();
  const aiSummary = t("novelcrafterAiSettingsSummary")
    .replace("{gem}", masterGem ? masterGem.name : t("novelcrafterNoMasterGem"))
    .replace("{persona}", masterPersona ? masterPersona.name : t("novelcrafterNoMasterPersona"));

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
    <>
      <header className="shrink-0 border-b border-(--line) bg-(--bg) px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: Pane Toggle + Story Title */}
        <div className="flex flex-wrap items-center gap-2 basis-full sm:basis-0 sm:flex-1 min-w-0">
          {isMobileLayout && (
            <button
              type="button"
              onClick={onOpenSidebar}
              aria-label={t("novelcrafterOpenStoriesMenu")}
              className="p-2 rounded-lg border border-(--line) bg-(--raised) text-(--text) shrink-0 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          {!isMobileLayout && (
            <button
              type="button"
              onClick={onToggleLeftPane}
              aria-pressed={showLeftPane}
              aria-label={t("novelcrafterToggleNavigatorPane")}
              className={cn(
                "p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0",
                showLeftPane
                  ? "bg-(--raised) border-(--line) text-(--accent)"
                  : "bg-(--raised) border-(--line) text-(--muted) hover:text-(--text)"
              )}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
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
              className="w-full min-w-16 sm:min-w-32 bg-transparent font-serif italic text-lg md:text-xl text-(--text) placeholder:text-(--muted) rounded-md px-2 py-1 border border-transparent hover:border-(--line) focus:border-(--line) focus:bg-(--raised) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none transition-colors truncate"
            />
          </div>
          {isMobileLayout && (
            <NovelcrafterTopBarMenu
              onExportManuscript={onExportManuscript}
              showAppSettings
              mobileActions={{ onOpenAiSettings: onOpenRoutingModal, onToggleLeftPane }}
            />
          )}
          {!isMobileLayout && viewTabs}
        </div>

        {/* Right: Silent Status + Model Selector + Master GEM/Persona + Routing + Export + History Pane */}
        <div className="w-full sm:w-auto flex items-center justify-end gap-2 flex-wrap">
          {isMobileLayout && <div className="mr-auto min-w-0">{viewTabs}</div>}
          {saveStatus === "error" ? (
            <button
              type="button"
              onClick={onRetrySave}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-(--warning) hover:underline px-2 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{t("novelcrafterRetrySave")}</span>
            </button>
          ) : (
            <div
              aria-live="polite"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-(--muted) select-none px-1.5"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-(--accent) animate-spin shrink-0" />
                  <span>{t("novelcrafterSaving")}</span>
                </>
              ) : saveStatus === "unsaved" ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-(--warning) shrink-0" />
                  <span>{t("novelcrafterUnsaved")}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-(--muted)/80 shrink-0" />
                  <span>{t("novelcrafterSaved")}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                {t("novelcrafterChapterWordsCount").replace(
                  "{count}",
                  chapterWordCount.toLocaleString()
                )}
              </span>
            </div>
          )}

          <ModelSelector
            currentModelId={selectedModel}
            onSelectModel={onSelectModel}
            isModelAllowed={(id) => isModelAllowedById(id, allowedModelIds)}
            disabled={false}
            expandDown={true}
          />

          {!isMobileLayout && (
            <button
              type="button"
              onClick={onOpenRoutingModal}
              aria-label={t("novelcrafterRoutingButton")}
              aria-describedby={aiSummaryId}
              title={aiSummary}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-(--line) text-xs font-medium text-(--text) hover:bg-(--raised) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
            >
              <Settings2 aria-hidden="true" className="w-3.5 h-3.5 text-(--accent) shrink-0" />
              <span className="hidden sm:inline">{t("novelcrafterRoutingButton")}</span>
            </button>
          )}
          <span id={aiSummaryId} className="sr-only">
            {aiSummary}
          </span>

          {!isMobileLayout && <NovelcrafterTopBarMenu onExportManuscript={onExportManuscript} />}

          {/* Mobile: AI cards are opened from the bottom AI dock instead. */}
          {!isMobileLayout && (
            <button
              type="button"
              onClick={onToggleRightPane}
              aria-pressed={showRightPane}
              aria-label={t("novelcrafterToggleHistoryPane")}
              className={cn(
                "relative inline-flex items-center gap-1 p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                showRightPane
                  ? "bg-(--raised) border-(--line) text-(--accent)"
                  : "bg-(--raised) border-(--line) text-(--muted) hover:text-(--text)"
              )}
            >
              <PanelRight className="w-4 h-4" />
              {historyCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-(--accent)/20 text-(--accent) text-xs font-bold">
                  {historyCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      <Dialog
        open={Boolean(renamingStoryId)}
        onOpenChange={(open) => !open && onCloseRenameStoryModal?.()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameChat")}</DialogTitle>
          </DialogHeader>
          <Input
            type="text"
            value={renameStoryTitle}
            onChange={(e) => onChangeRenameStoryTitle?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmRenameStory?.();
            }}
            autoFocus
            className="h-11"
            placeholder={t("novelcrafterStoryTitlePlaceholder")}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onCloseRenameStoryModal}>
              {t("cancel")}
            </Button>
            <Button onClick={onConfirmRenameStory} disabled={!renameStoryTitle.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
