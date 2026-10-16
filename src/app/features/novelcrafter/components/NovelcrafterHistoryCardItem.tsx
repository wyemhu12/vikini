// /app/features/novelcrafter/components/NovelcrafterHistoryCardItem.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeftToLine,
  BookCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Replace,
  Trash2,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { stripCardTruncationNotice } from "@/lib/features/novelcrafter/stateLimits";
import { parseThreeOpenings } from "@/lib/features/novelcrafter/openingsParser";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterFeatureSlot,
  NovelcrafterHistoryCard,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { useOverflowDetection } from "../hooks/useOverflowDetection";
import NovelcrafterCardMetaBadges from "./NovelcrafterCardMetaBadges";

const FEATURE_SLOT_KEYS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterSlotBible",
  write: "novelcrafterSlotWrite",
  rewrite: "novelcrafterSlotRewrite",
  feedback: "novelcrafterSlotFeedback",
  expand: "novelcrafterSlotExpand",
  brainstorm: "novelcrafterSlotBrainstorm",
};

interface NovelcrafterHistoryCardItemProps {
  card: NovelcrafterHistoryCard;
  forceExpanded?: boolean | null;
  hasActiveSelection: boolean;
  onAppendToChapter: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  onApplyToBible: (target: NovelcrafterBibleTarget, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onCopy: (text: string) => Promise<void>;
}

export default function NovelcrafterHistoryCardItem({
  card,
  forceExpanded,
  hasActiveSelection,
  onAppendToChapter,
  onReplaceSelection,
  onApplyToBible,
  onDeleteCard,
  onCopy,
}: NovelcrafterHistoryCardItemProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (typeof forceExpanded === "boolean") {
      setIsExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  const { contentRef, isOverflowing } = useOverflowDetection<HTMLDivElement>({
    content: card.content,
    isExpanded,
  });

  const displaySlot: NovelcrafterFeatureSlot = card.subSlot || card.feature;
  const isFeedbackCard = displaySlot === "feedback";
  const cleanContent = stripCardTruncationNotice(card.content);
  const parsedOpenings = card.feature === "write" ? parseThreeOpenings(cleanContent) : [];
  const threeOpenings = parsedOpenings.length >= 2 ? parsedOpenings : null;
  const contentBodyId = `nc-card-body-${card.id}`;

  return (
    <article
      data-testid={`history-card-${card.id}`}
      className="rounded-2xl border border-(--border) bg-(--surface-elevated)/90 p-3.5 space-y-2.5 shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <span className="inline-block text-xs font-bold text-(--accent) truncate">
            {card.actionLabel || card.subLabel || t(FEATURE_SLOT_KEYS[displaySlot])}
          </span>
          <NovelcrafterCardMetaBadges
            model={card.model}
            routedModel={card.routedModel}
            gemName={card.gemName}
            personaName={card.personaName}
            finishReason={card.finishReason}
          />
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

      {/* Collapsible Content Body pushing sibling cards down in normal flex document flow */}
      <div className="relative">
        <div
          id={contentBodyId}
          ref={contentRef}
          className={cn(
            "text-xs md:text-sm text-(--text-primary) whitespace-pre-wrap leading-relaxed transition-[max-height] duration-200",
            isExpanded ? "max-h-none overflow-visible" : "max-h-[180px] overflow-hidden"
          )}
        >
          {card.content}
        </div>

        {!isExpanded && isOverflowing && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-(--surface-elevated) to-transparent"
          />
        )}
      </div>

      {isOverflowing && (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentBodyId}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full py-1 px-2.5 rounded-lg border border-(--border) bg-(--control-bg)/70 hover:bg-(--control-bg-hover) text-xs font-semibold text-(--accent) inline-flex items-center justify-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>{t("novelcrafterCardCollapse")}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>{t("novelcrafterCardExpand")}</span>
            </>
          )}
        </button>
      )}

      {/* Parsed 3 Openings Quick-Insert Buttons (UX-03) */}
      {threeOpenings && (
        <div className="pt-1.5 border-t border-(--border)/60 flex items-center gap-1.5 flex-wrap">
          {threeOpenings.map((openingOpt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onAppendToChapter(stripCardTruncationNotice(openingOpt.content));
                toast.success(t("novelcrafterCardAppliedToast"));
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--accent)/40 bg-(--accent)/10 hover:bg-(--accent)/20 text-xs font-semibold text-(--accent) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <ArrowLeftToLine className="w-3 h-3" />
              <span>
                {t("novelcrafterInsertOpeningOption").replace("{index}", String(idx + 1))}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Card Actions */}
      <div className="pt-2 border-t border-(--border) flex items-center gap-1.5 flex-wrap">
        {!isFeedbackCard &&
          (card.feature === "bible" && card.bibleTarget && card.bibleTarget !== "draft" ? (
            <button
              type="button"
              onClick={() => {
                onApplyToBible(card.bibleTarget!, cleanContent);
                toast.success(t("novelcrafterCardAppliedToast"));
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <BookCheck className="w-3.5 h-3.5" />
              <span>
                {t("novelcrafterApplyToBible").replace("{target}", card.bibleTarget.toUpperCase())}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onAppendToChapter(cleanContent);
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
              onReplaceSelection(cleanContent);
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
          onClick={() => void onCopy(cleanContent)}
          aria-label={t("copy")}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{t("copy")}</span>
        </button>
      </div>
    </article>
  );
}
