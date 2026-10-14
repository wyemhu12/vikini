// /app/features/novelcrafter/components/NovelcrafterLeftNavigator.tsx
"use client";

import React, { useState } from "react";
import { BookMarked, Check, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";

interface NovelcrafterLeftNavigatorProps {
  isStoryBibleOpen: boolean;
  onSelectStoryBible: () => void;
  chapters: NovelcrafterChapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onRenameChapter: (chapterId: string, newTitle: string) => void;
  onDeleteChapter: (chapterId: string) => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function NovelcrafterLeftNavigator({
  isStoryBibleOpen,
  onSelectStoryBible,
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
      className="w-full md:w-64 lg:w-72 shrink-0 border-r border-(--border) bg-(--surface-muted)/60 flex flex-col min-h-0"
    >
      <h2 className="sr-only">{t("novelcrafterChaptersTab")}</h2>

      {/* Story Bible Primary Switch */}
      <div className="p-3 border-b border-(--border)">
        <button
          type="button"
          onClick={onSelectStoryBible}
          aria-pressed={isStoryBibleOpen}
          className={cn(
            "w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
            isStoryBibleOpen
              ? "bg-(--accent) text-(--accent-foreground) border-(--accent) shadow-sm"
              : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <BookMarked className="w-4 h-4 shrink-0" />
            <span className="truncate">{t("novelcrafterStoryBibleTab")}</span>
          </span>
        </button>
      </div>

      {/* Chapters Header */}
      <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
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

      {/* Chapters List */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-1.5 custom-scrollbar">
        {chapters.map((chapter, index) => {
          const isSelected = !isStoryBibleOpen && chapter.id === activeChapterId;
          const isEditing = editingChapterId === chapter.id;
          const words = countWords(chapter.content);

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
                        {words} {t("novelcrafterWordsUnit")}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
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
    </aside>
  );
}
