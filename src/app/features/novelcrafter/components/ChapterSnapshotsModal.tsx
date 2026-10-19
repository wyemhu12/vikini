// /app/features/novelcrafter/components/ChapterSnapshotsModal.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Clock, History, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { computeWordDiff } from "@/lib/features/novelcrafter/feedbackParser";
import {
  MAX_CHAPTER_SNAPSHOTS,
  MAX_SNAPSHOT_LABEL_CHARS,
  type NovelcrafterChapterSnapshot,
} from "@/lib/features/novelcrafter/types";

interface ChapterSnapshotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterTitle: string;
  currentContent: string;
  snapshots: NovelcrafterChapterSnapshot[];
  onCreateSnapshot: (label?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}

export default function ChapterSnapshotsModal({
  isOpen,
  onClose,
  chapterTitle,
  currentContent,
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
}: ChapterSnapshotsModalProps) {
  const { t } = useLanguage();
  const [labelDraft, setLabelDraft] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const activeSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    if (selectedSnapshotId) {
      const found = snapshots.find((s) => s.id === selectedSnapshotId);
      if (found) return found;
    }
    return snapshots[0];
  }, [snapshots, selectedSnapshotId]);

  const wordDiffSegments = useMemo(() => {
    if (!activeSnapshot) return [];
    return computeWordDiff(activeSnapshot.content, currentContent);
  }, [activeSnapshot, currentContent]);

  const handleCreate = () => {
    const trimmed = labelDraft.trim();
    onCreateSnapshot(trimmed ? trimmed : undefined);
    setLabelDraft("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85dvh] flex flex-col overflow-hidden bg-(--surface) border-(--border) text-(--text-primary)">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="w-4 h-4 text-(--accent) shrink-0" />
            <span className="truncate">
              {t("novelcrafterSnapshotsModalTitle")} — {chapterTitle} ({snapshots.length}/
              {MAX_CHAPTER_SNAPSHOTS})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 pt-1 pb-3 border-b border-(--border) shrink-0 flex-wrap">
          <input
            type="text"
            maxLength={MAX_SNAPSHOT_LABEL_CHARS}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
              }
            }}
            placeholder={t("novelcrafterSnapshotLabelPlaceholder")}
            aria-label={t("novelcrafterSnapshotLabelPlaceholder")}
            className="flex-1 min-w-[200px] h-9 rounded-xl border border-(--border) bg-(--surface-elevated) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          />
          <button
            type="button"
            disabled={!currentContent.trim()}
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("novelcrafterCreateSnapshotBtn")}</span>
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-(--text-secondary)">
            {t("novelcrafterSnapshotEmptyState")}
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 overflow-hidden">
            <div className="md:col-span-5 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {snapshots.map((snap) => {
                const isSelected = activeSnapshot?.id === snap.id;
                const formattedTime = new Date(snap.createdAt).toLocaleString();
                return (
                  <div
                    key={snap.id}
                    className={cn(
                      "rounded-xl border p-2.5 space-y-2 transition-colors",
                      isSelected
                        ? "border-(--accent) bg-(--accent)/10"
                        : "border-(--border) bg-(--surface-elevated)/60 hover:bg-(--surface-elevated)"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedSnapshotId(snap.id)}
                      className="w-full text-left space-y-1 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-(--text-primary) truncate">
                          {snap.label || formattedTime}
                        </span>
                        <span className="text-xs text-(--text-secondary) shrink-0">
                          {snap.wordCount.toLocaleString()} {t("novelcrafterWordsUnit")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-(--text-secondary)">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{formattedTime}</span>
                      </div>
                    </button>

                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-(--border)/60">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreSnapshot(snap.id);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--accent)"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t("novelcrafterRestoreSnapshotBtn")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSnapshot(snap.id)}
                        aria-label={t("novelcrafterDeleteSnapshotBtn")}
                        title={t("novelcrafterDeleteSnapshotBtn")}
                        className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="md:col-span-7 flex flex-col min-h-0 rounded-xl border border-(--border) bg-(--surface-elevated)/40 overflow-hidden">
              <div className="px-3 py-2 border-b border-(--border) bg-(--surface-muted)/60 text-xs font-semibold text-(--text-secondary)">
                {t("novelcrafterSnapshotWordDiffLabel")}
              </div>
              <div className="flex-1 min-h-0 p-3.5 overflow-y-auto custom-scrollbar text-xs leading-[1.7] whitespace-pre-wrap text-(--text-primary)">
                {wordDiffSegments.map((seg, idx) => {
                  if (seg.type === "delete") {
                    return (
                      <span
                        key={idx}
                        className="bg-(--danger)/20 text-(--danger) line-through rounded-xs px-0.5"
                      >
                        {seg.text}
                      </span>
                    );
                  }
                  if (seg.type === "insert") {
                    return (
                      <span
                        key={idx}
                        className="bg-(--success)/20 text-(--success) font-medium rounded-xs px-0.5"
                      >
                        {seg.text}
                      </span>
                    );
                  }
                  return <span key={idx}>{seg.text}</span>;
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
