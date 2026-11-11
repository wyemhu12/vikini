// /app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { logger } from "@/lib/utils/logger";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterHistoryCard,
} from "@/lib/features/novelcrafter/types";
import type { StreamingCardMeta } from "../hooks/useNovelcrafterStream";
import NovelcrafterCardMetaBadges from "./NovelcrafterCardMetaBadges";
import NovelcrafterHistoryCardItem from "./NovelcrafterHistoryCardItem";

interface NovelcrafterHistoryPaneProps {
  historyCards: NovelcrafterHistoryCard[];
  isStreaming: boolean;
  streamingContent: string;
  streamingThinking: string;
  streamingMeta: StreamingCardMeta | null;
  hasActiveSelection: boolean;
  onAppendToChapter: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  onApplyToBible: (target: NovelcrafterBibleTarget, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onClearAllCards: () => void;
  activeChapterId?: string;
  composer?: React.ReactNode;
  isInSheet?: boolean;
}

export default function NovelcrafterHistoryPane({
  historyCards,
  isStreaming,
  streamingContent,
  streamingThinking,
  streamingMeta,
  hasActiveSelection,
  onAppendToChapter,
  onReplaceSelection,
  onApplyToBible,
  onDeleteCard,
  onClearAllCards,
  activeChapterId,
  composer,
  isInSheet = false,
}: NovelcrafterHistoryPaneProps) {
  const { t } = useLanguage();
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);
  const [chapterScope, setChapterScope] = useState<"all" | "chapter">("all");

  const visibleCards = useMemo(() => {
    if (!activeChapterId || chapterScope === "all") return historyCards;
    return historyCards.filter((card) => card.chapterId === activeChapterId);
  }, [activeChapterId, chapterScope, historyCards]);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(t("novelcrafterCardCopiedToast"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Clipboard copy failed";
      logger.error("[NovelcrafterHistoryPane] copy failed:", msg);
      toast.error(msg);
    }
  };

  return (
    <aside
      aria-label={t("novelcrafterHistoryTitle")}
      className="w-full md:w-80 lg:w-[340px] shrink-0 border-l border-(--line) bg-(--surface) flex flex-col min-h-0 h-full"
    >
      <div
        className={cn(
          "min-h-14 px-4 py-2.5 border-b border-(--line) flex items-center justify-between gap-2 shrink-0",
          isInSheet && "pr-10"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-4 h-4 text-(--accent) shrink-0" />
          <h2 className="text-sm font-semibold text-(--text) truncate">
            {t("novelcrafterHistoryTitle")}{" "}
            <span className="font-normal text-(--faint)">· {visibleCards.length}</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeChapterId && historyCards.length > 0 && (
            <button
              type="button"
              onClick={() => setChapterScope((prev) => (prev === "all" ? "chapter" : "all"))}
              className="h-7 rounded-lg border border-(--line) bg-transparent px-2 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              {chapterScope === "chapter"
                ? t("novelcrafterHistoryFilterChapter")
                : t("novelcrafterHistoryFilterAll")}
            </button>
          )}

          {historyCards.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAllExpanded((prev) => (prev === true ? false : true))}
                aria-label={
                  allExpanded ? t("novelcrafterCollapseAllCards") : t("novelcrafterExpandAllCards")
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded px-1.5 py-0.5"
              >
                {allExpanded ? (
                  <>
                    <ChevronsDownUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t("novelcrafterCollapseAllCards")}</span>
                  </>
                ) : (
                  <>
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t("novelcrafterExpandAllCards")}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClearAllCards}
                className="text-xs font-medium text-(--muted) hover:text-(--danger) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded px-1.5 py-0.5"
              >
                {t("novelcrafterClearHistory")}
              </button>
            </>
          )}
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 custom-scrollbar"
      >
        {isStreaming && (
          <div className="rounded-xl border border-(--accent) bg-(--bg) p-3.5 space-y-2.5">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--accent)">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{streamingMeta?.subLabel || t("novelcrafterStreamingLabel")}</span>
              </span>
              <NovelcrafterCardMetaBadges
                model={streamingMeta?.model}
                routedModel={streamingMeta?.routedModel}
                gemName={streamingMeta?.gemName}
                personaName={streamingMeta?.personaName}
              />
            </div>

            {streamingThinking && (
              <div className="rounded-lg bg-(--raised) border border-(--line) p-2.5 text-xs text-(--muted) italic whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar">
                {streamingThinking}
              </div>
            )}

            <div className="text-sm text-(--text) whitespace-pre-wrap leading-relaxed">
              {streamingContent || t("novelcrafterStreamingLabel")}
            </div>
          </div>
        )}

        {!isStreaming && visibleCards.length === 0 && (
          <div className="py-10 px-4 text-center space-y-2">
            <Sparkles className="w-7 h-7 text-(--faint) mx-auto" />
            <p className="text-xs text-(--muted) leading-relaxed">
              {t("novelcrafterHistoryEmpty")}
            </p>
          </div>
        )}

        {visibleCards.map((card) => (
          <NovelcrafterHistoryCardItem
            key={card.id}
            card={card}
            forceExpanded={allExpanded}
            hasActiveSelection={hasActiveSelection}
            onAppendToChapter={onAppendToChapter}
            onReplaceSelection={onReplaceSelection}
            onApplyToBible={onApplyToBible}
            onDeleteCard={onDeleteCard}
            onCopy={handleCopy}
          />
        ))}
      </div>

      {composer}
    </aside>
  );
}
