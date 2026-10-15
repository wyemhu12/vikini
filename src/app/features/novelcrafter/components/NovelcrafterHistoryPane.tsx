// /app/features/novelcrafter/components/NovelcrafterHistoryPane.tsx
"use client";

import React from "react";
import {
  ArrowLeftToLine,
  BookCheck,
  Copy,
  Crown,
  Loader2,
  Replace,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterFeatureSlot,
  NovelcrafterHistoryCard,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import type { StreamingCardMeta } from "../hooks/useNovelcrafterStream";

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

const FEATURE_SLOT_KEYS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterSlotBible",
  write: "novelcrafterSlotWrite",
  rewrite: "novelcrafterSlotRewrite",
  feedback: "novelcrafterSlotFeedback",
  expand: "novelcrafterSlotExpand",
  brainstorm: "novelcrafterSlotBrainstorm",
};

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
      className="w-full md:w-80 lg:w-96 shrink-0 border-l border-(--border) bg-(--surface-muted)/60 flex flex-col min-h-0"
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
          <button
            type="button"
            onClick={onClearAllCards}
            className="text-xs font-medium text-(--text-secondary) hover:text-(--danger) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded px-1.5 py-0.5"
          >
            {t("novelcrafterClearHistory")}
          </button>
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
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-(--accent)">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{streamingMeta?.subLabel || t("novelcrafterStreamingLabel")}</span>
              </span>
              {streamingMeta?.model && (
                <span className="text-xs text-(--text-secondary) truncate max-w-[120px]">
                  {streamingMeta.model}
                </span>
              )}
            </div>

            {(streamingMeta?.gemName || streamingMeta?.personaName) && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-(--text-secondary)">
                {streamingMeta.gemName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-(--control-bg) border border-(--border)">
                    <Crown className="w-3 h-3 text-(--accent)" />
                    <span>{streamingMeta.gemName}</span>
                  </span>
                )}
                {streamingMeta.personaName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-(--control-bg) border border-(--border)">
                    <UserCheck className="w-3 h-3 text-(--accent)" />
                    <span>{streamingMeta.personaName}</span>
                  </span>
                )}
              </div>
            )}

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
        {historyCards.map((card) => {
          const displaySlot: NovelcrafterFeatureSlot = card.subSlot || card.feature;
          const isFeedbackCard = displaySlot === "feedback";

          return (
            <article
              key={card.id}
              className="rounded-2xl border border-(--border) bg-(--surface-elevated)/90 p-3.5 space-y-2.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <span className="inline-block text-xs font-bold text-(--accent) truncate">
                    {card.actionLabel || card.subLabel || t(FEATURE_SLOT_KEYS[displaySlot])}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-(--text-secondary)">
                    {card.gemName && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-(--control-bg) border border-(--border)">
                        <Crown className="w-3 h-3 text-(--accent)" />
                        <span className="truncate max-w-[100px]">{card.gemName}</span>
                      </span>
                    )}
                    {card.personaName && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-(--control-bg) border border-(--border)">
                        <UserCheck className="w-3 h-3 text-(--accent)" />
                        <span className="truncate max-w-[100px]">{card.personaName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteCard(card.id)}
                  aria-label={t("novelcrafterDeleteCard")}
                  className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs md:text-sm text-(--text-primary) whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {card.content}
              </div>

              {/* Card Actions (hide append/replace on Feedback cards per m28) */}
              <div className="pt-2 border-t border-(--border) flex items-center gap-1.5 flex-wrap">
                {!isFeedbackCard &&
                  (card.feature === "bible" && card.bibleTarget && card.bibleTarget !== "draft" ? (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyToBible(card.bibleTarget!, card.content);
                        toast.success(t("novelcrafterCardAppliedToast"));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
                    >
                      <BookCheck className="w-3.5 h-3.5" />
                      <span>
                        {t("novelcrafterApplyToBible").replace(
                          "{target}",
                          card.bibleTarget.toUpperCase()
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onAppendToChapter(card.content);
                        toast.success(t("novelcrafterCardAppliedToast"));
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
                    >
                      <ArrowLeftToLine className="w-3.5 h-3.5" />
                      <span>{t("novelcrafterAppendChapter")}</span>
                    </button>
                  ))}

                {!isFeedbackCard && hasActiveSelection && (
                  <button
                    type="button"
                    onClick={() => {
                      onReplaceSelection(card.content);
                      toast.success(t("novelcrafterCardAppliedToast"));
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <Replace className="w-3.5 h-3.5" />
                    <span>{t("novelcrafterReplaceSelection")}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleCopy(card.content)}
                  aria-label={t("copy")}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t("copy")}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
