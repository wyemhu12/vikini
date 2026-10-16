// /app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx
"use client";

import React, { useState } from "react";
import {
  BookMarked,
  Check,
  Compass,
  Feather,
  FileText,
  Globe,
  Lightbulb,
  ListTree,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";

export type NovelcrafterBibleSectionId =
  | "braindump"
  | "genre"
  | "style"
  | "synopsis"
  | "characters"
  | "worldbuilding"
  | "outline";

interface NovelcrafterLeftNavigatorProps {
  isStoryBibleOpen: boolean;
  onToggleStoryBible: (open: boolean) => void;
  activeBibleSection?: NovelcrafterBibleSectionId;
  onJumpToBibleSection: (sectionId: NovelcrafterBibleSectionId) => void;
  chapters: NovelcrafterChapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onRenameChapter: (chapterId: string, newTitle: string) => void;
  onDeleteChapter: (chapterId: string) => void;
}

const BIBLE_TOC_ITEMS: ReadonlyArray<{
  id: NovelcrafterBibleSectionId;
  labelKey: TranslationKey;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "braindump", labelKey: "novelcrafterBraindumpLabel", Icon: Lightbulb },
  { id: "genre", labelKey: "novelcrafterGenreLabel", Icon: Compass },
  { id: "style", labelKey: "novelcrafterStyleLabel", Icon: Feather },
  { id: "synopsis", labelKey: "novelcrafterSynopsisLabel", Icon: ScrollText },
  { id: "characters", labelKey: "novelcrafterCharactersLabel", Icon: Users },
  { id: "worldbuilding", labelKey: "novelcrafterWorldbuildingLabel", Icon: Globe },
  { id: "outline", labelKey: "novelcrafterOutlineLabel", Icon: ListTree },
];

export default function NovelcrafterLeftNavigator({
  isStoryBibleOpen,
  onToggleStoryBible,
  activeBibleSection,
  onJumpToBibleSection,
  chapters,
  activeChapterId,
  onSelectChapter,
  onAddChapter,
  onRenameChapter,
  onDeleteChapter,
}: NovelcrafterLeftNavigatorProps) {
  const { t } = useLanguage();
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const startEdit = (chapter: NovelcrafterChapter) => {
    setEditingChapterId(chapter.id);
    setEditingTitle(chapter.title);
  };

  const commitEdit = (chapterId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameChapter(chapterId, trimmed);
    }
    setEditingChapterId(null);
  };

  return (
    <aside
      aria-label={t("novelcrafterChaptersTab")}
      className="w-full md:w-64 lg:w-72 shrink-0 border-r border-(--border) bg-(--surface-muted)/60 flex flex-col min-h-0 h-full"
    >
      <h2 className="sr-only">{t("novelcrafterChaptersTab")}</h2>

      {/* Top: Chapters Header & List (Sudowrite Layout) */}
      <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-(--text-secondary)">
          {t("novelcrafterChaptersTab")} ({chapters.length})
        </span>
        <button
          type="button"
          onClick={onAddChapter}
          aria-label={t("novelcrafterAddChapter")}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--accent) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("novelcrafterAddChapter")}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-1.5 custom-scrollbar min-h-0">
        {chapters.map((chapter, index) => {
          const isSelected = chapter.id === activeChapterId;
          const isEditing = editingChapterId === chapter.id;
          const words = countChapterWords(chapter.content);

          return (
            <div
              key={chapter.id}
              className={cn(
                "group rounded-xl border transition-all p-2",
                isSelected
                  ? "bg-(--surface-elevated) border-(--control-border) shadow-sm"
                  : "bg-transparent border-transparent hover:bg-(--control-bg)/60 hover:border-(--border)"
              )}
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(chapter.id);
                      if (e.key === "Escape") setEditingChapterId(null);
                    }}
                    autoFocus
                    aria-label={t("novelcrafterRenameChapter")}
                    className="flex-1 min-w-0 bg-(--control-bg) border border-(--control-border) rounded-lg px-2 py-1 text-xs text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => commitEdit(chapter.id)}
                    aria-label={t("save")}
                    className="p-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingChapterId(null)}
                    aria-label={t("cancel")}
                    className="p-1.5 rounded-lg bg-(--control-bg) text-(--text-secondary) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectChapter(chapter.id)}
                    aria-pressed={isSelected}
                    className="flex-1 min-w-0 text-left flex items-start gap-2.5 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-lg"
                  >
                    <FileText
                      className={cn(
                        "w-4 h-4 mt-0.5 shrink-0",
                        isSelected ? "text-(--accent)" : "text-(--text-secondary)"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-semibold truncate",
                          isSelected ? "text-(--text-primary)" : "text-(--text-secondary)"
                        )}
                      >
                        {index + 1}. {chapter.title}
                      </p>
                      <p className="text-xs text-(--text-secondary) opacity-80">
                        {words.toLocaleString()} {t("novelcrafterWordsUnit")}
                      </p>
                    </div>
                  </button>

                  {/* Touch-friendly visibility on mobile/foldable (NC-R02) */}
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(chapter)}
                      aria-label={t("novelcrafterRenameChapter")}
                      className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteChapter(chapter.id)}
                      aria-label={t("novelcrafterDeleteChapter")}
                      className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom: Story Bible Toggle & Quick-Jump TOC (Sudowrite Bottom Navigator) */}
      <div className="shrink-0 border-t border-(--border) bg-(--surface)/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onToggleStoryBible(!isStoryBibleOpen)}
            aria-pressed={isStoryBibleOpen}
            className="flex items-center gap-2 text-xs font-bold text-(--text-primary) hover:text-(--accent) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-md py-0.5"
          >
            <BookMarked className="w-4 h-4 text-(--accent) shrink-0" />
            <span>{t("novelcrafterStoryBibleTab")}</span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={isStoryBibleOpen}
            aria-label={t("novelcrafterStoryBibleTab")}
            onClick={() => onToggleStoryBible(!isStoryBibleOpen)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              isStoryBibleOpen ? "bg-(--accent)" : "bg-(--control-bg-hover)"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-(--surface-elevated) shadow-xs transition-transform",
                isStoryBibleOpen ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* 7 Quick-Jump Bible Sections */}
        <nav aria-label={t("novelcrafterStoryBibleTab")} className="grid grid-cols-1 gap-0.5">
          {BIBLE_TOC_ITEMS.map(({ id, labelKey, Icon }) => {
            const isActive = isStoryBibleOpen && activeBibleSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onJumpToBibleSection(id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                  isActive
                    ? "bg-(--accent)/15 text-(--accent) font-semibold"
                    : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)/60"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
