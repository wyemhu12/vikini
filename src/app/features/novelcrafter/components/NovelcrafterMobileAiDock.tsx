// /app/features/novelcrafter/components/NovelcrafterMobileAiDock.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Lightbulb,
  PenTool,
  RefreshCw,
  Square,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";

export interface NovelcrafterMobileBeatBarProps {
  beats: readonly string[];
  onToggleBeats: () => void;
}

/** Compact 44px scene beat stepper bar on mobile screens (< md) per NovelMobile.dc.html. */
export function NovelcrafterMobileBeatBar({
  beats,
  onToggleBeats,
}: NovelcrafterMobileBeatBarProps) {
  const { t } = useLanguage();
  const [beatIdx, setBeatIdx] = useState(0);

  useEffect(() => {
    if (beatIdx >= beats.length) {
      setBeatIdx(0);
    }
  }, [beatIdx, beats.length]);

  if (beats.length === 0) return null;
  const safeIndex = Math.min(beatIdx, beats.length - 1);

  return (
    <div className="md:hidden shrink-0 h-11 px-1.5 flex items-center gap-1 bg-(--surface) border-b border-(--line)">
      <button
        type="button"
        aria-label={t("novelcrafterPrevBeatAria")}
        disabled={beats.length <= 1}
        onClick={() => setBeatIdx((prev) => (prev - 1 + beats.length) % beats.length)}
        className="h-9 w-9 shrink-0 rounded-lg inline-flex items-center justify-center text-(--muted) hover:text-(--text) disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onToggleBeats}
        className="flex-1 min-w-0 px-2 py-1 rounded-lg text-center text-xs text-(--text) truncate hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <span className="font-mono font-semibold text-(--accent)">
          {safeIndex + 1}/{beats.length}
        </span>{" "}
        <span aria-hidden="true">·</span> <span>{beats[safeIndex]}</span>
      </button>

      <button
        type="button"
        aria-label={t("novelcrafterNextBeatAria")}
        disabled={beats.length <= 1}
        onClick={() => setBeatIdx((prev) => (prev + 1) % beats.length)}
        className="h-9 w-9 shrink-0 rounded-lg inline-flex items-center justify-center text-(--muted) hover:text-(--text) disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface NovelcrafterMobileAiDockProps {
  isStreaming: boolean;
  historyCount: number;
  onRunAutoWrite: () => void;
  onStopStream: () => void;
  onRunRewriteSelection: () => void;
  onRunBrainstorm: () => void;
  onOpenHistoryDrawer: () => void;
}

/** Bottom mobile AI dock (< md) matching NovelMobile.dc.html (Vikini 3.0 phase 5E). */
export function NovelcrafterMobileAiDock({
  isStreaming,
  historyCount,
  onRunAutoWrite,
  onStopStream,
  onRunRewriteSelection,
  onRunBrainstorm,
  onOpenHistoryDrawer,
}: NovelcrafterMobileAiDockProps) {
  const { t } = useLanguage();
  const cardsAria =
    historyCount > 0
      ? t("novelcrafterMobileCardsCountAria").replace("{count}", String(historyCount))
      : t("novelcrafterHistoryTitle");

  return (
    <nav
      aria-label={t("novelcrafterMobileAiDockAria")}
      className="md:hidden shrink-0 px-3 pt-2.5 pb-[calc(0.75rem+var(--sab,0px))] flex items-center gap-2 bg-(--surface) border-t border-(--line)"
    >
      {isStreaming ? (
        <button
          type="button"
          onClick={onStopStream}
          className="flex-1 h-12 rounded-xl bg-(--accent) text-(--on-accent) text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Square aria-hidden="true" className="h-4 w-4 fill-current" />
          <span>{t("stopBtn")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onRunAutoWrite}
          className="flex-1 h-12 rounded-xl bg-(--accent) text-(--on-accent) text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <PenTool aria-hidden="true" className="h-4 w-4" />
          <span>{t("novelcrafterWriteMenuBtn")}</span>
        </button>
      )}

      <button
        type="button"
        aria-label={t("novelcrafterMobileRewriteSelectionAria")}
        disabled={isStreaming}
        onClick={onRunRewriteSelection}
        className="h-12 w-12 shrink-0 rounded-xl border border-(--line) bg-transparent text-(--text) inline-flex items-center justify-center hover:bg-(--raised) disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <RefreshCw aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label={t("novelcrafterMobileBrainstormAria")}
        disabled={isStreaming}
        onClick={onRunBrainstorm}
        className="h-12 w-12 shrink-0 rounded-xl border border-(--line) bg-transparent text-(--text) inline-flex items-center justify-center hover:bg-(--raised) disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <Lightbulb aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        type="button"
        aria-label={cardsAria}
        onClick={onOpenHistoryDrawer}
        className="relative h-12 w-12 shrink-0 rounded-xl border border-(--line) bg-transparent text-(--text) inline-flex items-center justify-center hover:bg-(--raised) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        <Layers aria-hidden="true" className="h-5 w-5" />
        {historyCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-(--accent) text-(--on-accent) text-xs font-bold leading-4 text-center"
          >
            {historyCount}
          </span>
        )}
      </button>
    </nav>
  );
}
