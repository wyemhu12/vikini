// /app/features/novelcrafter/components/ChapterEditorWorkspace.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageSquareQuote, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { TRANSITION } from "@/lib/utils/motion";
import {
  applyFeedbackSuggestionToText,
  findQuoteRangeInText,
} from "@/lib/features/novelcrafter/feedbackParser";
import type {
  NovelcrafterChapter,
  NovelcrafterFeedbackItem,
  NovelcrafterRewriteMode,
} from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import ChapterAiToolbar from "./ChapterAiToolbar";
import type { ActiveChapterToolMenu } from "./ChapterAiToolMenus";
import ChapterFeedbackGutter from "./ChapterFeedbackGutter";

export interface EditorSelectionRange {
  start: number;
  end: number;
  text: string;
}

interface ChapterEditorWorkspaceProps {
  chapter: NovelcrafterChapter;
  onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  onUpdateFeedbackItems: (
    chapterId: string,
    updater: (items: NovelcrafterFeedbackItem[]) => NovelcrafterFeedbackItem[],
    immediate?: boolean
  ) => void;
  selection: EditorSelectionRange | null;
  onSelectionChange: (sel: EditorSelectionRange | null) => void;
  isStreaming: boolean;
  isDirectStreamingToChapter: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onStopStream: () => void;
}

export default function ChapterEditorWorkspace({
  chapter,
  onUpdateChapter,
  onUpdateFeedbackItems,
  selection,
  onSelectionChange,
  isStreaming,
  isDirectStreamingToChapter,
  onTriggerStream,
  onStopStream,
}: ChapterEditorWorkspaceProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [beatsOpen, setBeatsOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveChapterToolMenu>(null);
  const [showFeedbackGutter, setShowFeedbackGutter] = useState(false);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditPrompt, setQuickEditPrompt] = useState("");

  useEffect(() => setTitleDraft(chapter.title), [chapter.id, chapter.title]);

  const feedbackItems = useMemo(() => chapter.feedbackItems ?? [], [chapter.feedbackItems]);
  const openFeedbackCount = useMemo(
    () => feedbackItems.filter((item) => item.status === "open").length,
    [feedbackItems]
  );

  useEffect(() => {
    if (openFeedbackCount > 0) setShowFeedbackGutter(true);
  }, [openFeedbackCount]);

  const activeFeedbackItem = useMemo(
    () => feedbackItems.find((item) => item.id === activeFeedbackId) || null,
    [feedbackItems, activeFeedbackId]
  );

  const handleTitleBlur = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(chapter.title);
      return;
    }
    if (trimmed !== chapter.title) onUpdateChapter(chapter.id, { title: trimmed });
  };

  const handleSelectText = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    onSelectionChange(end > start ? { start, end, text: el.value.slice(start, end) } : null);
  };

  const jumpToFeedbackQuote = (item: NovelcrafterFeedbackItem) => {
    setActiveFeedbackId(item.id);
    if (!item.quote || !textareaRef.current) return;
    const range = findQuoteRangeInText(chapter.content, item.quote);
    if (!range) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(range.start, range.end);
    onSelectionChange({
      start: range.start,
      end: range.end,
      text: chapter.content.slice(range.start, range.end),
    });
  };

  const handleAcceptSuggestion = (item: NovelcrafterFeedbackItem) => {
    const result = applyFeedbackSuggestionToText(chapter.content, item.quote, item.suggestion);
    if (!result.applied) {
      toast.info(t("novelcrafterQuoteModifiedBadge"));
      return;
    }
    onUpdateChapter(chapter.id, {
      content: result.updatedContent,
      feedbackItems: feedbackItems.map((f) =>
        f.id === item.id ? { ...f, status: "resolved" } : f
      ),
    });
    toast.success(t("novelcrafterCardAppliedToast"));
  };

  const requireSelectionText = (): string | null => {
    const selected = selection?.text?.trim() || "";
    if (!selected) toast.info(t("novelcrafterSelectTextHint"));
    return selected || null;
  };

  const handleRunFirstDraft = () =>
    void onTriggerStream({
      feature: "bible",
      bibleTarget: "draft",
      actionMode: "generate",
      subLabel: t("novelcrafterFirstDraftCtaBtn"),
    });

  const handleRunRewrite = (
    mode: NovelcrafterRewriteMode,
    label: string,
    customInstruction?: string
  ) => {
    const selected = requireSelectionText();
    if (!selected) return;
    void onTriggerStream({
      feature: "rewrite",
      rewriteMode: mode,
      selectedText: selected,
      customInstruction: customInstruction?.trim() || "",
      subLabel: label,
    });
    setActiveMenu(null);
    setQuickEditOpen(false);
    setQuickEditPrompt("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-(--surface)">
      <ChapterAiToolbar
        activeMenu={activeMenu}
        onSelectMenu={setActiveMenu}
        isStreaming={isStreaming}
        onStopStream={onStopStream}
        selectedCharCount={selection?.text.length ?? 0}
        beatsOpen={beatsOpen}
        onToggleBeats={() => setBeatsOpen((p) => !p)}
        openFeedbackCount={openFeedbackCount}
        showFeedbackGutter={showFeedbackGutter}
        onToggleFeedbackGutter={() => setShowFeedbackGutter((p) => !p)}
        onRunFirstDraft={handleRunFirstDraft}
        onRunWrite={(p) => {
          void onTriggerStream({ feature: "write", writeMode: p.mode, ...p });
          setActiveMenu(null);
        }}
        onRunRewrite={handleRunRewrite}
        onRunFeedback={(p) => {
          if (!chapter.content.trim() && !selection?.text?.trim()) {
            toast.info(t("novelcrafterSelectTextHint"));
            return;
          }
          setShowFeedbackGutter(true);
          void onTriggerStream({
            feature: "feedback",
            feedbackMode: p.mode,
            feedbackCriteria: p.criteria,
            selectedText: selection?.text?.trim() || "",
            customInstruction: p.customInstruction,
            subLabel: p.subLabel,
          });
          setActiveMenu(null);
        }}
        onRunExpand={(mode, label, senses) => {
          const selected = requireSelectionText();
          if (!selected) return;
          void onTriggerStream({
            feature: "expand",
            expandMode: mode,
            describeSenses: senses,
            selectedText: selected,
            subLabel: label,
          });
          setActiveMenu(null);
        }}
        onRunBrainstorm={(category, label, topic) => {
          void onTriggerStream({
            feature: "brainstorm",
            brainstormCategory: category,
            customInstruction: topic?.trim() || "",
            subLabel: label,
          });
          setActiveMenu(null);
        }}
      />

      <div className="flex-1 min-h-0 mx-2 md:mx-4 my-2 md:my-3 rounded-2xl border border-(--border) bg-(--surface-elevated)/35 flex flex-col lg:flex-row overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col">
          {isDirectStreamingToChapter && (
            <div className="mx-6 md:mx-12 lg:mx-16 mt-4 px-3.5 py-2 rounded-xl border border-(--accent)/40 bg-(--accent)/10 flex items-center justify-between gap-2 text-xs font-medium text-(--accent)">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{t("novelcrafterDirectStreamingBanner")}</span>
              </span>
              <button
                type="button"
                onClick={onStopStream}
                className="px-2.5 py-0.5 rounded-md bg-(--danger) text-(--danger-foreground) font-semibold"
              >
                {t("stopBtn")}
              </button>
            </div>
          )}

          <div className="px-6 md:px-12 lg:px-16 pt-7 pb-3">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label={t("novelcrafterRenameChapter")}
              className="w-full max-w-[820px] bg-transparent text-[22px] md:text-[24px] font-semibold leading-[1.3] tracking-[-0.015em] text-(--text-primary) placeholder:text-(--text-secondary) border-b border-transparent hover:border-(--border) focus:border-(--accent) focus:outline-none pb-1 transition-colors"
            />
          </div>

          <AnimatePresence initial={false}>
            {beatsOpen && (
              <motion.section
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={TRANSITION.FAST}
                className="px-6 md:px-12 lg:px-16 pb-4 overflow-hidden shrink-0"
              >
                <div className="max-w-[820px] rounded-2xl border border-(--border) bg-(--surface)/85 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-(--text-secondary)">
                      {t("novelcrafterChapterBeatsLabel")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBeatsOpen(false)}
                      aria-label={t("close")}
                      className="p-1 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={chapter.scenes}
                    onChange={(e) => onUpdateChapter(chapter.id, { scenes: e.target.value })}
                    placeholder={t("novelcrafterChapterBeatsPlaceholder")}
                    aria-label={t("novelcrafterChapterBeatsLabel")}
                    className="w-full rounded-xl border border-(--border) bg-(--surface-elevated)/60 px-4 py-3 text-[14px] leading-[1.65] tracking-[-0.005em] text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
                  />
                  <input
                    type="text"
                    value={chapter.extraInstructions ?? ""}
                    onChange={(e) =>
                      onUpdateChapter(chapter.id, { extraInstructions: e.target.value })
                    }
                    placeholder={t("novelcrafterExtraInstructionsPlaceholder")}
                    aria-label={t("novelcrafterExtraInstructionsLabel")}
                    className="w-full h-9 rounded-xl border border-(--border) bg-(--surface-elevated)/40 px-3.5 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={isStreaming}
                        onClick={() =>
                          void onTriggerStream({
                            feature: "bible",
                            bibleTarget: "scenes",
                            actionMode: "generate",
                            subLabel: t("novelcrafterGenerateBeatsBtn"),
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-(--accent)" />
                        <span>{t("novelcrafterGenerateBeatsBtn")}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isStreaming}
                        onClick={() =>
                          void onTriggerStream({
                            feature: "bible",
                            bibleTarget: "scenes",
                            actionMode: "rewrite",
                            subLabel: t("novelcrafterRewriteBeatsBtn"),
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-(--text-secondary)" />
                        <span>{t("novelcrafterRewriteBeatsBtn")}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isStreaming}
                      onClick={handleRunFirstDraft}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold shadow-xs disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t("novelcrafterGenerateDraftBtn")}</span>
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {activeFeedbackItem && activeFeedbackItem.quote && (
            <div className="px-6 md:px-12 lg:px-16 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => jumpToFeedbackQuote(activeFeedbackItem)}
                className="w-full max-w-[820px] text-left rounded-xl bg-(--warning)/15 border-l-2 border-(--warning) px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-(--text-primary) hover:bg-(--warning)/20 transition-colors"
              >
                <span className="inline-flex items-center gap-2 min-w-0 truncate">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-(--warning) shrink-0" />
                  <span className="font-semibold uppercase text-(--warning)">
                    [{activeFeedbackItem.category}]
                  </span>
                  <span className="truncate italic">&ldquo;{activeFeedbackItem.quote}&rdquo;</span>
                </span>
                <span className="text-[11px] font-semibold text-(--accent) shrink-0">
                  {t("novelcrafterExcerptLocatorJump")}
                </span>
              </button>
            </div>
          )}

          {quickEditOpen && selection && (
            <div className="px-6 md:px-12 lg:px-16 pb-2 shrink-0">
              <div className="max-w-[820px] flex items-center gap-2 rounded-xl border border-(--accent) bg-(--surface) p-2 shadow-sm">
                <input
                  type="text"
                  value={quickEditPrompt}
                  onChange={(e) => setQuickEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleRunRewrite("custom", t("novelcrafterQuickEditBtn"), quickEditPrompt);
                    if (e.key === "Escape") setQuickEditOpen(false);
                  }}
                  autoFocus
                  placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
                  aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
                  className="flex-1 min-w-0 h-8 bg-transparent px-2 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleRunRewrite("custom", t("novelcrafterQuickEditBtn"), quickEditPrompt)
                  }
                  className="px-3 py-1 rounded-lg bg-(--accent) text-(--accent-foreground) text-xs font-semibold"
                >
                  {t("novelcrafterQuickEditBtn")}
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 px-6 md:px-12 lg:px-16 pb-10 flex flex-col">
            <textarea
              ref={textareaRef}
              readOnly={isDirectStreamingToChapter}
              value={chapter.content}
              onChange={(e) => onUpdateChapter(chapter.id, { content: e.target.value })}
              onSelect={handleSelectText}
              onKeyUp={handleSelectText}
              onMouseUp={handleSelectText}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                  e.preventDefault();
                  if (selection && selection.text.trim()) setQuickEditOpen((p) => !p);
                  else toast.info(t("novelcrafterSelectTextHint"));
                }
              }}
              placeholder={t("novelcrafterChapterEditorPlaceholder")}
              aria-label={chapter.title}
              className="flex-1 w-full max-w-[820px] min-h-[420px] bg-transparent border-0 p-0 text-[16px] md:text-[17px] leading-[1.8] tracking-[-0.005em] antialiased text-(--text-primary) placeholder:text-(--text-secondary)/70 focus:outline-none resize-none custom-scrollbar"
            />
          </div>
        </div>

        {showFeedbackGutter && (
          <ChapterFeedbackGutter
            feedbackItems={feedbackItems}
            chapterContent={chapter.content}
            activeFeedbackId={activeFeedbackId}
            onSelectFeedback={jumpToFeedbackQuote}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDismissFeedback={(itemId) => {
              onUpdateFeedbackItems(
                chapter.id,
                (items) => items.map((f) => (f.id === itemId ? { ...f, status: "resolved" } : f)),
                true
              );
              if (activeFeedbackId === itemId) setActiveFeedbackId(null);
            }}
            onRateFeedback={(itemId, rating) =>
              onUpdateFeedbackItems(
                chapter.id,
                (items) => items.map((f) => (f.id === itemId ? { ...f, rating } : f)),
                true
              )
            }
            onReplyFeedback={(item, replyText) => {
              onUpdateFeedbackItems(
                chapter.id,
                (items) =>
                  items.map((f) => (f.id === item.id ? { ...f, userReply: replyText } : f)),
                true
              );
              void onTriggerStream({
                feature: "feedback",
                feedbackMode: "custom",
                selectedText: item.quote || selection?.text || "",
                customInstruction: `${item.comment}\nUser follow-up: ${replyText}`,
                subLabel: `${t("novelcrafterSlotFeedback")} · ${item.category}`,
              });
            }}
            onResolveAll={() =>
              onUpdateFeedbackItems(
                chapter.id,
                (items) => items.map((f) => ({ ...f, status: "resolved" })),
                true
              )
            }
            onClearAll={() => onUpdateFeedbackItems(chapter.id, () => [], true)}
          />
        )}
      </div>
    </div>
  );
}
