// /app/features/novelcrafter/components/ChapterEditorWorkspace.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import {
  applyFeedbackSuggestionToText,
  findQuoteRangeInText,
} from "@/lib/features/novelcrafter/feedbackParser";
import {
  computeQuoteScrollTop,
  measureCaretOffsetTop,
} from "@/lib/features/novelcrafter/quoteScrollPositioning";
import type {
  NovelcrafterChapter,
  NovelcrafterFeedbackItem,
  NovelcrafterRewriteMode,
  StoryBible,
} from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import ChapterAiToolbar from "./ChapterAiToolbar";
import type { ActiveChapterToolMenu } from "./ChapterAiToolMenus";
import ChapterFeedbackGutter from "./ChapterFeedbackGutter";
import ChapterDraftBeatsCard from "./ChapterDraftBeatsCard";
import ChapterEmptyStateActions from "./ChapterEmptyStateActions";
import InlineStoryBibleSection from "./InlineStoryBibleSection";
import SheetSubToolbar, { type EditorFontSizePreset } from "./SheetSubToolbar";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea";

export interface EditorSelectionRange {
  start: number;
  end: number;
  text: string;
}

const FONT_SIZE_CLASSES: Record<EditorFontSizePreset, string> = {
  sm: "text-[15px] leading-[1.75]",
  md: "text-[16px] md:text-[17px] leading-[1.8]",
  lg: "text-[18px] md:text-[19px] leading-[1.85]",
};

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
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  isStoryBibleOpen: boolean;
  onToggleStoryBible: (open: boolean) => void;
  activeBibleSection?: NovelcrafterBibleSectionId;
  bibleJumpRequest?: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  feedbackMode?: "inline" | "bottom-sheet";
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
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
  storyBible,
  onUpdateStoryBible,
  isStoryBibleOpen,
  onToggleStoryBible,
  activeBibleSection,
  bibleJumpRequest,
  feedbackMode = "inline",
  focusMode = false,
  onToggleFocusMode,
}: ChapterEditorWorkspaceProps) {
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [beatsOpen, setBeatsOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveChapterToolMenu>(null);
  const [showFeedbackGutter, setShowFeedbackGutter] = useState(false);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditPrompt, setQuickEditPrompt] = useState("");
  const [fontSizePreset, setFontSizePreset] = useState<EditorFontSizePreset>("md");

  const textareaRef = useAutoResizeTextarea<HTMLTextAreaElement>({
    value: chapter.content,
    minHeight: 420,
    chapterId: chapter.id,
    scrollContainerRef,
  });

  useEffect(() => setTitleDraft(chapter.title), [chapter.id, chapter.title]);
  useEffect(
    () => () => {
      if (scrollRafRef.current !== null && typeof window !== "undefined")
        window.cancelAnimationFrame(scrollRafRef.current);
    },
    []
  );

  const feedbackItems = useMemo(() => chapter.feedbackItems ?? [], [chapter.feedbackItems]);
  const openFeedbackCount = useMemo(
    () => feedbackItems.filter((item) => item.status === "open").length,
    [feedbackItems]
  );
  const wordCount = useMemo(() => countChapterWords(chapter.content), [chapter.content]);

  useEffect(() => {
    if (openFeedbackCount > 0) setShowFeedbackGutter(true);
  }, [openFeedbackCount]);

  const activeFeedbackItem = useMemo(
    () => feedbackItems.find((item) => item.id === activeFeedbackId) || null,
    [feedbackItems, activeFeedbackId]
  );

  const handleTitleBlur = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return setTitleDraft(chapter.title);
    if (trimmed !== chapter.title) onUpdateChapter(chapter.id, { title: trimmed });
  };

  const handleSelectText = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    onSelectionChange(end > start ? { start, end, text: el.value.slice(start, end) } : null);
  };

  const handleApplyMarkdownFormat = (
    fmt: "bold" | "italic" | "strike" | "h1" | "h2" | "ul" | "ol" | "hr"
  ) => {
    const el = textareaRef.current;
    const content = chapter.content;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || "text";
    const map = {
      bold: `**${selected}**`,
      italic: `*${selected}*`,
      strike: `~~${selected}~~`,
      h1: `\n# ${selected}\n`,
      h2: `\n## ${selected}\n`,
      ul: `\n- ${selected}`,
      ol: `\n1. ${selected}`,
      hr: `\n\n***\n\n`,
    };
    onUpdateChapter(chapter.id, {
      content: `${content.slice(0, start)}${map[fmt]}${content.slice(end)}`,
    });
  };

  const jumpToFeedbackQuote = (item: NovelcrafterFeedbackItem) => {
    setActiveFeedbackId(item.id);
    if (feedbackMode === "bottom-sheet") setShowFeedbackGutter(false);
    if (!item.quote || !textareaRef.current) return;
    const range = findQuoteRangeInText(chapter.content, item.quote);
    if (!range) return;

    textareaRef.current.focus({ preventScroll: true });
    textareaRef.current.setSelectionRange(range.start, range.end);
    onSelectionChange({
      start: range.start,
      end: range.end,
      text: chapter.content.slice(range.start, range.end),
    });

    if (typeof window !== "undefined") {
      if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const container = scrollContainerRef.current;
        const textarea = textareaRef.current;
        if (!container || !textarea) return;
        const quoteOffsetTop = measureCaretOffsetTop(textarea, range.start);
        const containerRect = container.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const targetTop = computeQuoteScrollTop({
          textareaRectTop: textareaRect.top,
          containerRectTop: containerRect.top,
          containerScrollTop: container.scrollTop,
          quoteOffsetTop,
          containerClientHeight: container.clientHeight,
        });
        container.scrollTo({ top: targetTop, behavior: "smooth" });
      });
    }
  };

  const handleAcceptSuggestion = (item: NovelcrafterFeedbackItem) => {
    const result = applyFeedbackSuggestionToText(chapter.content, item.quote, item.suggestion);
    if (!result.applied) return toast.info(t("novelcrafterQuoteModifiedBadge"));
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

  const gutterNode = (
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
          (items) => items.map((f) => (f.id === item.id ? { ...f, userReply: replyText } : f)),
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
  );

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
          if (!chapter.content.trim() && !selection?.text?.trim())
            return toast.info(t("novelcrafterSelectTextHint"));
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
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pb-[var(--nc-kb-offset,0px)]"
        >
          <SheetSubToolbar
            wordCount={wordCount}
            fontSizePreset={fontSizePreset}
            onChangeFontSizePreset={setFontSizePreset}
            focusMode={focusMode}
            onToggleFocusMode={() => onToggleFocusMode?.()}
            onApplyMarkdownFormat={handleApplyMarkdownFormat}
          />

          {isDirectStreamingToChapter && (
            <div className="mx-6 md:px-12 lg:px-16 mt-4 px-3.5 py-2 rounded-xl border border-(--accent)/40 bg-(--accent)/10 flex items-center justify-between gap-2 text-xs font-medium text-(--accent)">
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

          <div className="px-6 md:px-12 lg:px-16 pt-6 pb-3">
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              aria-label={t("novelcrafterRenameChapter")}
              className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl bg-transparent text-[22px] md:text-[24px] font-semibold leading-[1.3] tracking-[-0.015em] text-(--text-primary) placeholder:text-(--text-secondary) border-b border-transparent hover:border-(--border) focus:border-(--accent) focus:outline-none pb-1 transition-colors"
            />
          </div>

          <ChapterDraftBeatsCard
            isOpen={beatsOpen}
            onClose={() => setBeatsOpen(false)}
            scenes={chapter.scenes}
            onChangeScenes={(val) => onUpdateChapter(chapter.id, { scenes: val })}
            extraInstructions={chapter.extraInstructions ?? ""}
            onChangeExtraInstructions={(val) =>
              onUpdateChapter(chapter.id, { extraInstructions: val })
            }
            isStreaming={isStreaming}
            onGenerateBeats={() =>
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "scenes",
                actionMode: "generate",
                subLabel: t("novelcrafterGenerateBeatsBtn"),
              })
            }
            onRewriteBeats={() =>
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "scenes",
                actionMode: "rewrite",
                subLabel: t("novelcrafterRewriteBeatsBtn"),
              })
            }
            onRunFirstDraft={handleRunFirstDraft}
          />

          {chapter.content.trim().length === 0 && !isStreaming && (
            <ChapterEmptyStateActions
              disabled={isStreaming}
              onAutoWriteOpening={() =>
                void onTriggerStream({
                  feature: "write",
                  writeMode: "auto",
                  subLabel: t("novelcrafterEmptyActionAutoWrite"),
                })
              }
              onSuggestThreeOpenings={() =>
                void onTriggerStream({
                  feature: "write",
                  writeMode: "openings_3",
                  subLabel: t("novelcrafterEmptyActionOpenings3"),
                })
              }
              onRoughDraftFromBeats={() =>
                void onTriggerStream({
                  feature: "write",
                  writeMode: "first_draft_rough",
                  subLabel: t("novelcrafterEmptyActionRoughDraft"),
                })
              }
            />
          )}

          {activeFeedbackItem && activeFeedbackItem.quote && (
            <div className="px-6 md:px-12 lg:px-16 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => jumpToFeedbackQuote(activeFeedbackItem)}
                className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl text-left rounded-xl bg-(--warning)/15 border-l-2 border-(--warning) px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-(--text-primary) hover:bg-(--warning)/20 transition-colors"
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
              <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex items-center gap-2 rounded-xl border border-(--accent) bg-(--surface) p-2 shadow-sm">
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

          <div className="px-6 md:px-12 lg:px-16 pb-6 flex flex-col">
            <textarea
              key={chapter.id}
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
              className={cn(
                "w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl min-h-[420px] [field-sizing:content] bg-transparent border-0 p-0 tracking-[-0.005em] antialiased text-(--text-primary) placeholder:text-(--text-secondary)/70 focus:outline-none resize-none custom-scrollbar",
                FONT_SIZE_CLASSES[fontSizePreset]
              )}
            />

            <InlineStoryBibleSection
              isOpen={isStoryBibleOpen}
              onToggle={() => onToggleStoryBible(!isStoryBibleOpen)}
              storyBible={storyBible}
              onUpdateStoryBible={onUpdateStoryBible}
              activeSection={activeBibleSection}
              jumpRequest={bibleJumpRequest}
              isStreaming={isStreaming}
              onTriggerStream={onTriggerStream}
              onSendOutlineToChapterScenes={(beats) => {
                const sep = chapter.scenes.trim() ? "\n\n" : "";
                onUpdateChapter(chapter.id, { scenes: `${chapter.scenes}${sep}${beats.trim()}` });
                setBeatsOpen(true);
              }}
            />
          </div>
        </div>

        {showFeedbackGutter && feedbackMode === "inline" && gutterNode}
        {feedbackMode === "bottom-sheet" && (
          <Sheet open={showFeedbackGutter} onOpenChange={setShowFeedbackGutter}>
            <SheetContent side="bottom" className="p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("novelcrafterFeedbackDrawerTitle")}</SheetTitle>
              </SheetHeader>
              {gutterNode}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
