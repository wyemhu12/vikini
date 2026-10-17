// /app/features/novelcrafter/components/NovelcrafterTopBar.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  Crown,
  PanelLeft,
  PanelRight,
  Settings2,
  UserCheck,
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
  masterGem: ClientGemItem | null;
  masterPersona: ClientPersonaItem | null;
  saveStatus: StorySaveStatus;
  chapterWordCount: number;
  historyCount?: number;
  onRetrySave: () => void;
  onOpenRoutingModal: () => void;
  showLeftPane: boolean;
  onToggleLeftPane: () => void;
  showRightPane: boolean;
  onToggleRightPane: () => void;
  renamingStoryId?: string | null;
  renameStoryTitle?: string;
  onChangeRenameStoryTitle?: (val: string) => void;
  onCloseRenameStoryModal?: () => void;
  onConfirmRenameStory?: () => void;
}

export default function NovelcrafterTopBar({
  storyTitle,
  onRenameTitle,
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
  showLeftPane,
  onToggleLeftPane,
  showRightPane,
  onToggleRightPane,
  renamingStoryId,
  renameStoryTitle = "",
  onChangeRenameStoryTitle,
  onCloseRenameStoryModal,
  onConfirmRenameStory,
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
    <>
      <header className="shrink-0 border-b border-(--border) bg-(--surface-muted)/90 backdrop-blur-xl px-3 md:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: Pane Toggle + Story Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleLeftPane}
            aria-pressed={showLeftPane}
            aria-label={t("novelcrafterToggleNavigatorPane")}
            className={cn(
              "p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0",
              showLeftPane
                ? "bg-(--control-bg-hover) border-(--control-border) text-(--accent)"
                : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
            <BookOpen className="w-4 h-4 text-(--accent) shrink-0 hidden sm:inline" />
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
        </div>

        {/* Right: Silent Sudowrite Status + Model Selector + Master GEM/Persona + Routing + History Pane */}
        <div className="flex items-center gap-2 flex-wrap">
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
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-(--text-secondary) select-none px-1.5"
            >
              <Check className="w-3.5 h-3.5 text-(--text-secondary)/80 shrink-0" />
              <span>{t("novelcrafterSaved")}</span>
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

          <button
            type="button"
            onClick={onOpenRoutingModal}
            className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Settings2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t("novelcrafterRoutingButton")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleRightPane}
            aria-pressed={showRightPane}
            aria-label={t("novelcrafterToggleHistoryPane")}
            className={cn(
              "relative inline-flex items-center gap-1 p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              showRightPane
                ? "bg-(--control-bg-hover) border-(--control-border) text-(--accent)"
                : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            <PanelRight className="w-4 h-4" />
            {historyCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-(--accent)/20 text-(--accent) text-xs font-bold">
                {historyCount}
              </span>
            )}
          </button>
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
