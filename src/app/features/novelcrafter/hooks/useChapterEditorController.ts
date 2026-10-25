// /app/features/novelcrafter/hooks/useChapterEditorController.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import {
  applyFeedbackSuggestionToText,
  buildFeedbackReplyInstruction,
} from "@/lib/features/novelcrafter/feedbackParser";
import type {
  NovelcrafterBrainstormCategory,
  NovelcrafterChapter,
  NovelcrafterDescribeSense,
  NovelcrafterDevelopmentalCriterion,
  NovelcrafterExpandMode,
  NovelcrafterFeedbackItem,
  NovelcrafterFeedbackMode,
  NovelcrafterRewriteMode,
  NovelcrafterToneShift,
  NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import { toast } from "@/lib/store/toastStore";
import type { ActiveChapterToolMenu } from "../components/ChapterAiToolMenus";
import type { ManuscriptEditorHandle } from "../components/ChapterManuscriptEditor";
import type { ChapterSelectionQuickEditProps } from "../components/ChapterSelectionToolbar";
import type { EditorSelectionWithText } from "./useManuscriptEditor";
import type { TriggerNovelcrafterStreamParams } from "./useNovelcrafterStream";

export interface FeedbackPaneControl {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export interface UseChapterEditorControllerOptions {
  chapter: NovelcrafterChapter | null | undefined;
  selection: EditorSelectionWithText | null;
  onSelectionChange: (sel: EditorSelectionWithText | null) => void;
  isStreaming: boolean;
  isLoadLocked?: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  onUpdateFeedbackItems: (
    chapterId: string,
    updater: (items: NovelcrafterFeedbackItem[]) => NovelcrafterFeedbackItem[],
    immediate?: boolean
  ) => void;
  feedbackPane: FeedbackPaneControl;
  feedbackMode?: "inline" | "bottom-sheet";
}

export function useChapterEditorController({
  chapter,
  selection,
  isStreaming,
  isLoadLocked = false,
  onTriggerStream,
  onUpdateChapter,
  onUpdateFeedbackItems,
  feedbackPane,
  feedbackMode = "inline",
}: UseChapterEditorControllerOptions) {
  const { t } = useLanguage();
  const editorHandleRef = useRef<ManuscriptEditorHandle | null>(null);
  const chapterId = chapter?.id ?? "";
  const chapterContent = chapter?.content ?? "";

  const [beatsOpen, setBeatsOpen] = useState<boolean>(
    () => (chapter?.content.trim().length ?? 0) === 0
  );
  const [activeMenu, setActiveMenu] = useState<ActiveChapterToolMenu>(null);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditPrompt, setQuickEditPrompt] = useState("");

  useEffect(() => {
    setBeatsOpen((chapter?.content.trim().length ?? 0) === 0);
    setActiveFeedbackId(null);
    setQuickEditOpen(false);
    setQuickEditPrompt("");
  }, [chapterId]);

  const feedbackItems = useMemo(() => chapter?.feedbackItems ?? [], [chapter?.feedbackItems]);
  const openFeedbackCount = useMemo(
    () => feedbackItems.filter((item) => item.status === "open").length,
    [feedbackItems]
  );

  const prevOpenCountRef = useRef(openFeedbackCount);
  useEffect(() => {
    if (openFeedbackCount > prevOpenCountRef.current && openFeedbackCount > 0) {
      feedbackPane.open();
    }
    prevOpenCountRef.current = openFeedbackCount;
  }, [openFeedbackCount, feedbackPane]);

  const activeFeedbackItem = useMemo(
    () => feedbackItems.find((item) => item.id === activeFeedbackId) || null,
    [feedbackItems, activeFeedbackId]
  );

  const requireSelectionText = useCallback((): string | null => {
    const selected = selection?.text?.trim() || "";
    if (!selected) toast.info(t("novelcrafterSelectTextHint"));
    return selected || null;
  }, [selection, t]);

  const selectFeedbackById = useCallback(
    (id: string) => {
      setActiveFeedbackId(id);
      feedbackPane.open();
      if (editorHandleRef.current?.scrollToFeedback(id) === false) {
        toast.info(t("novelcrafterQuoteModifiedBadge"));
      }
    },
    [feedbackPane, t]
  );

  const jumpToFeedbackQuote = useCallback(
    (item: NovelcrafterFeedbackItem) => {
      setActiveFeedbackId(item.id);
      if (feedbackMode === "bottom-sheet") feedbackPane.close();
      if (!item.quote) return;
      if (editorHandleRef.current?.scrollToFeedback(item.id) === false) {
        toast.info(t("novelcrafterQuoteModifiedBadge"));
      }
    },
    [feedbackMode, feedbackPane, t]
  );

  const handleAcceptSuggestion = useCallback(
    (item: NovelcrafterFeedbackItem) => {
      if (!chapter) return;
      const result = applyFeedbackSuggestionToText(chapter.content, item.quote, item.suggestion);
      if (!result.applied) return toast.info(t("novelcrafterQuoteModifiedBadge"));
      onUpdateChapter(chapter.id, {
        content: result.updatedContent,
        feedbackItems: feedbackItems.map((f) =>
          f.id === item.id ? { ...f, status: "resolved" } : f
        ),
      });
      toast.success(t("novelcrafterCardAppliedToast"));
    },
    [chapter, feedbackItems, onUpdateChapter, t]
  );

  const handleRunFirstDraft = useCallback(() => {
    if (isStreaming || isLoadLocked) return;
    void onTriggerStream({
      feature: "bible",
      bibleTarget: "draft",
      actionMode: "generate",
      subLabel: t("novelcrafterFirstDraftCtaBtn"),
    });
  }, [isLoadLocked, isStreaming, onTriggerStream, t]);

  const handleRunWrite = useCallback(
    (p: {
      mode: NovelcrafterWriteMode;
      toneShift?: NovelcrafterToneShift;
      writeLengthWords?: number;
      keyDetails?: string;
      customInstruction?: string;
      subLabel: string;
    }) => {
      if (isStreaming || isLoadLocked) return;
      void onTriggerStream({ feature: "write", writeMode: p.mode, ...p });
      setActiveMenu(null);
    },
    [isLoadLocked, isStreaming, onTriggerStream]
  );

  const handleRunRewrite = useCallback(
    (mode: NovelcrafterRewriteMode, label: string, customInstruction?: string) => {
      if (isStreaming || isLoadLocked) return;
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
    },
    [isLoadLocked, isStreaming, onTriggerStream, requireSelectionText]
  );

  const handleRunFeedback = useCallback(
    (p: {
      mode: NovelcrafterFeedbackMode;
      criteria?: NovelcrafterDevelopmentalCriterion[];
      customInstruction?: string;
      subLabel: string;
    }) => {
      if (isStreaming || isLoadLocked) return;
      if (!chapterContent.trim() && !selection?.text?.trim()) {
        return toast.info(t("novelcrafterSelectTextHint"));
      }
      feedbackPane.open();
      void onTriggerStream({
        feature: "feedback",
        feedbackMode: p.mode,
        feedbackCriteria: p.criteria,
        selectedText: selection?.text?.trim() || "",
        customInstruction: p.customInstruction,
        subLabel: p.subLabel,
      });
      setActiveMenu(null);
    },
    [chapterContent, feedbackPane, isLoadLocked, isStreaming, onTriggerStream, selection, t]
  );

  const handleRunExpand = useCallback(
    (mode: NovelcrafterExpandMode, label: string, senses?: NovelcrafterDescribeSense[]) => {
      if (isStreaming || isLoadLocked) return;
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
    },
    [isLoadLocked, isStreaming, onTriggerStream, requireSelectionText]
  );

  const handleRunBrainstorm = useCallback(
    (category: NovelcrafterBrainstormCategory, label: string, topic?: string) => {
      if (isStreaming || isLoadLocked) return;
      void onTriggerStream({
        feature: "brainstorm",
        brainstormCategory: category,
        customInstruction: topic?.trim() || "",
        subLabel: label,
      });
      setActiveMenu(null);
    },
    [isLoadLocked, isStreaming, onTriggerStream]
  );

  const quickEdit: ChapterSelectionQuickEditProps = {
    open: quickEditOpen,
    prompt: quickEditPrompt,
    onToggle: () => {
      if (!selection?.text.trim()) return toast.info(t("novelcrafterSelectTextHint"));
      setQuickEditOpen((prev) => !prev);
    },
    onChangePrompt: setQuickEditPrompt,
    onSubmit: () => handleRunRewrite("custom", t("novelcrafterQuickEditBtn"), quickEditPrompt),
  };

  return {
    editorHandleRef,
    beatsOpen,
    setBeatsOpen,
    activeFeedbackId,
    setActiveFeedbackId,
    activeFeedbackItem,
    feedbackItems,
    openFeedbackCount,
    quickEdit,
    selectFeedbackById,
    jumpToFeedbackQuote,
    handleAcceptSuggestion,
    handleRunFirstDraft,
    handleRunRewrite,
    handleRunExpand,
    handleRunLineFeedback: (label: string) =>
      handleRunFeedback({ mode: "line_editing", subLabel: label }),
    handleDismissFeedback: (itemId: string) => {
      if (!chapter) return;
      onUpdateFeedbackItems(
        chapter.id,
        (items) => items.map((f) => (f.id === itemId ? { ...f, status: "resolved" } : f)),
        true
      );
      if (activeFeedbackId === itemId) setActiveFeedbackId(null);
    },
    handleRateFeedback: (itemId: string, rating: "up" | "down") => {
      if (!chapter) return;
      onUpdateFeedbackItems(
        chapter.id,
        (items) => items.map((f) => (f.id === itemId ? { ...f, rating } : f)),
        true
      );
    },
    handleReplyFeedback: (item: NovelcrafterFeedbackItem, replyText: string) => {
      if (!chapter || isStreaming || isLoadLocked) return;
      const { instruction, reply } = buildFeedbackReplyInstruction(item.comment, replyText);
      onUpdateFeedbackItems(
        chapter.id,
        (items) => items.map((f) => (f.id === item.id ? { ...f, userReply: reply } : f)),
        true
      );
      void onTriggerStream({
        feature: "feedback",
        feedbackMode: "custom",
        selectedText: item.quote || selection?.text || "",
        customInstruction: instruction,
        subLabel: `${t("novelcrafterSlotFeedback")} · ${item.category}`,
        replyToFeedbackId: item.id,
      });
    },
    handleResolveAllFeedback: () =>
      chapter &&
      onUpdateFeedbackItems(
        chapter.id,
        (items) => items.map((f) => ({ ...f, status: "resolved" })),
        true
      ),
    handleClearAllFeedback: () => chapter && onUpdateFeedbackItems(chapter.id, () => [], true),
    toolbarProps: {
      activeMenu,
      onSelectMenu: setActiveMenu,
      isStreaming: isStreaming || Boolean(isLoadLocked),
      selectedCharCount: selection?.text.length ?? 0,
      beatsOpen,
      onToggleBeats: () => setBeatsOpen((p) => !p),
      openFeedbackCount,
      showFeedbackGutter: feedbackPane.isOpen,
      onToggleFeedbackGutter: feedbackPane.toggle,
      onRunFirstDraft: handleRunFirstDraft,
      onRunWrite: handleRunWrite,
      onRunRewrite: handleRunRewrite,
      onRunFeedback: handleRunFeedback,
      onRunExpand: handleRunExpand,
      onRunBrainstorm: handleRunBrainstorm,
    },
  };
}

export type ChapterEditorController = ReturnType<typeof useChapterEditorController>;
