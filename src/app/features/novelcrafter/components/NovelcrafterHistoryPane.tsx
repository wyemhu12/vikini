// /app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx
"use client";

import React, { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
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
}: NovelcrafterHistoryPaneProps) {
  const { t } = useLanguage();
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);

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
      className="w-full md:w-80 lg:w-96 shrink-0 border-l border-(--border) bg-(--surface-muted)/60 flex flex-col min-h-0 h-full"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-(--border) flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-(--accent) shrink-0" />
          <h2 className="text-xs md:text-sm font-bold text-(--text-primary) truncate">
            {t("novelcrafterHistoryTitle")} ({historyCards.length})
          </h2>
        </div>

        {historyCards.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setAllExpanded((prev) => (prev === true ? false : true))}
              className="inline-flex items-center gap-1 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded px-1.5 py-0.5"
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
              className="text-xs font-medium text-(--text-secondary) hover:text-(--danger) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded px-1.5 py-0.5"
            >
              {t("novelcrafterClearHistory")}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Log Area */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3 custom-scrollbar"
      >
        {/* Live Streaming Card */}
        {isStreaming && (
          <div className="rounded-2xl border border-(--accent) bg-(--surface-elevated) p-3.5 space-y-2.5 shadow-md">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-(--accent)">
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
              <div className="rounded-xl bg-(--surface-muted) border border-(--border) p-2.5 text-xs text-(--text-secondary) italic whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar">
                {streamingThinking}
              </div>
            )}

            <div className="text-xs md:text-sm text-(--text-primary) whitespace-pre-wrap leading-relaxed">
              {streamingContent || t("novelcrafterStreamingLabel")}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isStreaming && historyCards.length === 0 && (
          <div className="py-12 px-4 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-(--text-secondary) opacity-40 mx-auto" />
            <p className="text-xs text-(--text-secondary) leading-relaxed">
              {t("novelcrafterHistoryEmpty")}
            </p>
          </div>
        )}

        {/* Persisted History Cards */}
        {historyCards.map((card) => (
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
    </aside>
  );
}
