// /app/features/novelcrafter/components/ChapterFeedbackGutter.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleArrowLeft,
  Copy,
  MessageSquareQuote,
  MoreHorizontal,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { computeWordDiff, findQuoteRangeInText } from "@/lib/features/novelcrafter/feedbackParser";
import { FIELD_MAX_LENGTHS } from "@/lib/features/novelcrafter/stateLimits";
import type { NovelcrafterFeedbackItem } from "@/lib/features/novelcrafter/types";

interface ChapterFeedbackGutterProps {
  feedbackItems: NovelcrafterFeedbackItem[];
  chapterContent: string;
  activeFeedbackId: string | null;
  onSelectFeedback: (item: NovelcrafterFeedbackItem) => void;
  onAcceptSuggestion: (item: NovelcrafterFeedbackItem) => void;
  onDismissFeedback: (itemId: string) => void;
  onRateFeedback: (itemId: string, rating: "up" | "down" | undefined) => void;
  onReplyFeedback: (item: NovelcrafterFeedbackItem, replyText: string) => void;
  onResolveAll: () => void;
  onClearAll: () => void;
  isInSheet?: boolean;
}

export default function ChapterFeedbackGutter({
  feedbackItems,
  chapterContent,
  activeFeedbackId,
  onSelectFeedback,
  onAcceptSuggestion,
  onDismissFeedback,
  onRateFeedback,
  onReplyFeedback,
  onResolveAll,
  onClearAll,
  isInSheet = false,
}: ChapterFeedbackGutterProps) {
  const { t } = useLanguage();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeFeedbackId || !listRef.current) return;
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(activeFeedbackId)
        : activeFeedbackId.replace(/[^A-Za-z0-9_-]/g, "");
    const cardEl = listRef.current.querySelector<HTMLElement>(
      `[data-feedback-card-id="${escaped}"]`
    );
    if (cardEl && typeof cardEl.scrollIntoView === "function") {
      cardEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeFeedbackId]);

  const openItems = useMemo(
    () => feedbackItems.filter((item) => item.status === "open"),
    [feedbackItems]
  );
  const resolvedItems = useMemo(
    () => feedbackItems.filter((item) => item.status === "resolved"),
    [feedbackItems]
  );

  const visibleItems = statusFilter === "open" ? openItems : resolvedItems;
  const activeIndex = useMemo(
    () => visibleItems.findIndex((i) => i.id === activeFeedbackId),
    [visibleItems, activeFeedbackId]
  );

  const handleStep = (delta: number) => {
    if (visibleItems.length === 0) return;
    const nextIdx =
      activeIndex < 0 ? 0 : (activeIndex + delta + visibleItems.length) % visibleItems.length;
    const nextItem = visibleItems[nextIdx];
    if (nextItem) onSelectFeedback(nextItem);
  };

  const handleCopySuggestion = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("novelcrafterCardCopiedToast"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Copy failed";
      toast.error(msg);
    }
  };

  const submitReply = (item: NovelcrafterFeedbackItem) => {
    const draft = (replyDrafts[item.id] ?? item.userReply ?? "").trim();
    if (!draft) return;
    onReplyFeedback(item, draft);
    setReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  return (
    <aside
      aria-label={t("novelcrafterSlotFeedback")}
      className="w-full lg:w-80 xl:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-(--border) bg-(--surface)/60 flex flex-col min-h-0"
    >
      {/* Top Gutter Filter & Navigation Header */}
      <div
        className={cn(
          "px-3.5 py-2.5 border-b border-(--border) flex items-center justify-between gap-2 shrink-0",
          isInSheet && "pr-10"
        )}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            aria-pressed={statusFilter === "open"}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              statusFilter === "open"
                ? "bg-(--accent)/15 text-(--accent)"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {t("novelcrafterFeedbackOpen")} {openItems.length}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            aria-pressed={statusFilter === "resolved"}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              statusFilter === "resolved"
                ? "bg-(--accent)/15 text-(--accent) font-bold"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {t("novelcrafterFeedbackResolved")} {resolvedItems.length}
          </button>
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={visibleItems.length === 0}
            aria-label={t("novelcrafterFeedbackPrevItem")}
            className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={visibleItems.length === 0}
            aria-label={t("novelcrafterFeedbackNextItem")}
            className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={t("novelcrafterFeedbackMoreActions")}
            className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-(--border) bg-(--surface-elevated) shadow-lg p-1.5 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onResolveAll();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-(--text-primary) hover:bg-(--control-bg-hover)"
              >
                {t("novelcrafterFeedbackResolveAll")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-(--danger) hover:bg-(--danger)/10"
              >
                {t("novelcrafterFeedbackClearAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Feedback Cards List */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {visibleItems.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <MessageSquareQuote className="w-7 h-7 text-(--text-secondary) opacity-40 mx-auto" />
            <p className="text-xs text-(--text-secondary) leading-relaxed">
              {t("novelcrafterFeedbackTooltip")}
            </p>
          </div>
        ) : (
          visibleItems.map((item) => {
            const isSelected = item.id === activeFeedbackId;
            const quoteRange = item.quote ? findQuoteRangeInText(chapterContent, item.quote) : null;
            const isQuoteModified = Boolean(item.quote && !quoteRange);
            const diffSegments =
              item.quote || item.suggestion ? computeWordDiff(item.quote, item.suggestion) : [];
            const currentReplyText = replyDrafts[item.id] ?? item.userReply ?? "";

            return (
              <article
                key={item.id}
                data-feedback-card-id={item.id}
                onClick={() => onSelectFeedback(item)}
                className={cn(
                  "rounded-2xl border p-3.5 space-y-2.5 transition-all cursor-pointer",
                  isSelected
                    ? "bg-(--surface-elevated) border-(--accent) shadow-md"
                    : "bg-(--surface-elevated)/80 border-(--border) hover:border-(--control-border)"
                )}
              >
                {/* 1. Category Badge + Accept (✓) / Dismiss (×) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/30 text-xs font-bold uppercase tracking-wider">
                      {item.category}
                    </span>
                    {isQuoteModified && (
                      <span className="text-xs text-(--warning) font-medium">
                        {t("novelcrafterQuoteModifiedBadge")}
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.suggestion && (
                      <button
                        type="button"
                        onClick={() => onAcceptSuggestion(item)}
                        aria-label={t("novelcrafterFeedbackAcceptBtn")}
                        title={t("novelcrafterFeedbackAcceptBtn")}
                        className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--success) hover:bg-(--success)/10 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDismissFeedback(item.id)}
                      aria-label={t("novelcrafterFeedbackDismissBtn")}
                      title={t("novelcrafterFeedbackDismissBtn")}
                      className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Editorial Critique Comment */}
                <p className="text-xs md:text-[13px] leading-relaxed text-(--text-primary)">
                  {item.comment}
                </p>

                {/* 3. Word-Level Diff Box (Strikethrough + Highlight) */}
                {diffSegments.length > 0 && (
                  <div className="rounded-xl border border-(--border) bg-(--surface)/90 p-3 text-xs md:text-[13px] leading-relaxed">
                    {diffSegments.map((seg, idx) => {
                      if (seg.type === "delete") {
                        return (
                          <span
                            key={idx}
                            className="line-through text-(--text-secondary) opacity-75"
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      if (seg.type === "insert") {
                        return (
                          <span
                            key={idx}
                            className="bg-(--accent)/15 text-(--accent) font-medium px-0.5 rounded-xs"
                          >
                            {seg.text}
                          </span>
                        );
                      }
                      return (
                        <span key={idx} className="text-(--text-primary)">
                          {seg.text}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* 4. Action Bar Below Diff: Insert (CircleArrowLeft) & Copy | ThumbsUp & ThumbsDown */}
                <div
                  className="flex items-center justify-between gap-2 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    {item.suggestion && (
                      <button
                        type="button"
                        onClick={() => onAcceptSuggestion(item)}
                        aria-label={t("novelcrafterFeedbackAcceptBtn")}
                        title={t("novelcrafterFeedbackAcceptBtn")}
                        className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--accent) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <CircleArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    {item.suggestion && (
                      <button
                        type="button"
                        onClick={() => void handleCopySuggestion(item.suggestion)}
                        aria-label={t("copy")}
                        title={t("copy")}
                        className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onRateFeedback(item.id, item.rating === "up" ? undefined : "up")
                      }
                      aria-pressed={item.rating === "up"}
                      aria-label={t("novelcrafterFeedbackRateUp")}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)",
                        item.rating === "up"
                          ? "text-(--accent) bg-(--accent)/15"
                          : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onRateFeedback(item.id, item.rating === "down" ? undefined : "down")
                      }
                      aria-pressed={item.rating === "down"}
                      aria-label={t("novelcrafterFeedbackRateDown")}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)",
                        item.rating === "down"
                          ? "text-(--danger) bg-(--danger)/10"
                          : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                      )}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 5. Reply / Follow-up Box (Reply [Ctrl ↵]) */}
                {isSelected && (
                  <div
                    className="pt-2 border-t border-(--border) space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <textarea
                      rows={2}
                      maxLength={FIELD_MAX_LENGTHS.feedbackReply}
                      value={currentReplyText}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          submitReply(item);
                        }
                      }}
                      placeholder={t("novelcrafterFeedbackReplyPlaceholder")}
                      aria-label={t("novelcrafterFeedbackReplyPlaceholder")}
                      className="w-full rounded-xl border border-(--control-border) bg-(--surface) px-2.5 py-2 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-none"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyDrafts((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-(--text-secondary) hover:text-(--text-primary)"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitReply(item)}
                        disabled={!currentReplyText.trim()}
                        className="px-2.5 py-1 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 disabled:opacity-50 text-xs font-semibold"
                      >
                        {t("novelcrafterFeedbackReplySubmit")} [Ctrl ↵]
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
