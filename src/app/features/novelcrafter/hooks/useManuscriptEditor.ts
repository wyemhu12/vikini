// /app/features/novelcrafter/hooks/useManuscriptEditor.ts
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  findCodexMentionRanges,
  type CodexMentionRange,
} from "@/lib/features/novelcrafter/codexMatcher";
import { buildRenderLines } from "@/lib/features/novelcrafter/manuscriptDecorations";
import {
  createInitialHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type ManuscriptHistoryState,
} from "@/lib/features/novelcrafter/manuscriptHistory";
import {
  applyManuscriptFormat,
  tokenizeManuscriptLines,
  type ManuscriptFormat,
} from "@/lib/features/novelcrafter/manuscriptMarkup";
import type { NovelcrafterFeedbackItem, StoryBible } from "@/lib/features/novelcrafter/types";
import {
  readSelectionOffsets,
  serializeManuscriptRoot,
  type ManuscriptSelectionRange,
} from "../utils/manuscriptDomOffsets";
import {
  buildManuscriptDecorations,
  normalizeInsertedText,
  reconcileDomLines,
  resolveBeforeInputAction,
  resolveEditorShortcutAction,
} from "../utils/manuscriptReconcile";

export interface EditorSelectionWithText {
  start: number;
  end: number;
  text: string;
}

export interface UseManuscriptEditorOptions {
  chapterId: string;
  content: string;
  readOnly: boolean;
  feedbackItems: readonly NovelcrafterFeedbackItem[];
  activeFeedbackId: string | null;
  storyBible: StoryBible;
  selection: EditorSelectionWithText | null;
  onChangeContent: (nextContent: string) => void;
  onSelectionChange: (selection: EditorSelectionWithText | null) => void;
  onToggleQuickEdit?: () => void;
}

export function useManuscriptEditor({
  chapterId,
  content,
  readOnly,
  feedbackItems,
  activeFeedbackId,
  storyBible,
  selection,
  onChangeContent,
  onSelectionChange,
  onToggleQuickEdit,
}: UseManuscriptEditorOptions) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;
  const lastEmittedRef = useRef(content);
  const isComposingRef = useRef(false);
  const historyRef = useRef<ManuscriptHistoryState>(createInitialHistory());
  const lastCaretRef = useRef<ManuscriptSelectionRange>({ start: 0, end: 0 });
  const rafRef = useRef<number | null>(null);
  const codexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [codexRanges, setCodexRanges] = useState<CodexMentionRange[]>(() =>
    findCodexMentionRanges(storyBible, content)
  );

  useEffect(() => {
    historyRef.current = createInitialHistory();
    lastEmittedRef.current = contentRef.current;
    lastCaretRef.current = { start: 0, end: 0 };
  }, [chapterId]);

  useEffect(() => {
    if (codexTimerRef.current !== null) clearTimeout(codexTimerRef.current);
    codexTimerRef.current = setTimeout(() => {
      codexTimerRef.current = null;
      setCodexRanges(findCodexMentionRanges(storyBible, content));
    }, 250);
    return () => {
      if (codexTimerRef.current !== null) {
        clearTimeout(codexTimerRef.current);
        codexTimerRef.current = null;
      }
    };
  }, [storyBible, content]);

  const decorations = useMemo(
    () =>
      buildManuscriptDecorations({
        content,
        feedbackItems,
        activeFeedbackId,
        codexRanges,
        isFocused,
        selection,
      }),
    [content, feedbackItems, activeFeedbackId, codexRanges, isFocused, selection]
  );

  const renderLines = useMemo(() => {
    const lines = tokenizeManuscriptLines(content);
    return buildRenderLines(content, lines, decorations);
  }, [content, decorations]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!readOnly && root.contentEditable !== "plaintext-only" && root.contentEditable !== "true") {
      root.contentEditable = "true";
    }
    if (content !== lastEmittedRef.current) {
      if (!readOnly) {
        historyRef.current = pushHistory(historyRef.current, {
          content: lastEmittedRef.current,
          selectionStart: lastCaretRef.current.start,
          selectionEnd: lastCaretRef.current.end,
          at: Date.now(),
        });
      }
      lastEmittedRef.current = content;
    }
    const caret = isFocused ? (readSelectionOffsets(root) ?? lastCaretRef.current) : null;
    reconcileDomLines(root, renderLines, caret);
  }, [content, renderLines, readOnly, isFocused]);

  const commitModelChange = useCallback(
    (nextContent: string, nextStart: number, nextEnd: number, coalesce = false) => {
      const prevContent = contentRef.current;
      historyRef.current = pushHistory(
        historyRef.current,
        {
          content: prevContent,
          selectionStart: lastCaretRef.current.start,
          selectionEnd: lastCaretRef.current.end,
          at: coalesce ? Date.now() : Date.now() + 10_000,
        },
        { coalesceMs: coalesce ? 800 : 0 }
      );
      lastEmittedRef.current = nextContent;
      contentRef.current = nextContent;
      lastCaretRef.current = { start: nextStart, end: nextEnd };
      onChangeContent(nextContent);
      onSelectionChange(
        nextEnd > nextStart
          ? { start: nextStart, end: nextEnd, text: nextContent.slice(nextStart, nextEnd) }
          : null
      );
      const root = rootRef.current;
      if (root) {
        const nextLines = buildRenderLines(
          nextContent,
          tokenizeManuscriptLines(nextContent),
          decorations
        );
        reconcileDomLines(root, nextLines, { start: nextStart, end: nextEnd });
      }
    },
    [decorations, onChangeContent, onSelectionChange]
  );

  const applyTextReplacement = useCallback(
    (insertedText: string) => {
      const root = rootRef.current;
      if (!root || readOnly) return;
      const normalized = normalizeInsertedText(insertedText);
      const current = contentRef.current;
      const sel = readSelectionOffsets(root) ?? lastCaretRef.current;
      const nextContent = `${current.slice(0, sel.start)}${normalized}${current.slice(sel.end)}`;
      const nextCaret = sel.start + normalized.length;
      commitModelChange(nextContent, nextCaret, nextCaret, normalized.length <= 2);
    },
    [commitModelChange, readOnly]
  );

  const applyHistoryDirection = useCallback(
    (direction: "undo" | "redo") => {
      if (readOnly) return;
      const snapshot = {
        content: contentRef.current,
        selectionStart: lastCaretRef.current.start,
        selectionEnd: lastCaretRef.current.end,
        at: Date.now(),
      };
      const res =
        direction === "undo"
          ? undoHistory(historyRef.current, snapshot)
          : redoHistory(historyRef.current, snapshot);
      if (!res.entry) return;
      historyRef.current = res.state;
      lastEmittedRef.current = res.entry.content;
      lastCaretRef.current = { start: res.entry.selectionStart, end: res.entry.selectionEnd };
      onChangeContent(res.entry.content);
    },
    [onChangeContent, readOnly]
  );

  const applyFormat = useCallback(
    (fmt: ManuscriptFormat) => {
      if (readOnly) return;
      const root = rootRef.current;
      const sel =
        (root ? readSelectionOffsets(root) : null) ??
        (selection ? { start: selection.start, end: selection.end } : lastCaretRef.current);
      const res = applyManuscriptFormat(contentRef.current, sel.start, sel.end, fmt);
      if (root && document.activeElement !== root) root.focus({ preventScroll: true });
      commitModelChange(res.content, res.selectionStart, res.selectionEnd, false);
    },
    [commitModelChange, readOnly, selection]
  );

  const handleInput = useCallback(() => {
    const root = rootRef.current;
    if (!root || readOnly || isComposingRef.current) return;
    const caret = readSelectionOffsets(root) ?? lastCaretRef.current;
    const nextContent = serializeManuscriptRoot(root);
    if (nextContent === contentRef.current) return;
    commitModelChange(nextContent, caret.start, caret.end, true);
  }, [commitModelChange, readOnly]);

  const handleBeforeInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      if (readOnly) {
        e.preventDefault();
        return;
      }
      const native = e.nativeEvent as InputEvent;
      const pasteText = native.dataTransfer?.getData("text/plain") ?? "";
      const action = resolveBeforeInputAction(native.inputType, pasteText);
      if (action.kind === "noop") {
        if (native.inputType === "insertFromPaste" || native.inputType === "insertFromDrop") {
          e.preventDefault();
        }
        return;
      }
      e.preventDefault();
      if (action.kind === "insertText") applyTextReplacement(action.text);
      else if (action.kind === "undo") applyHistoryDirection("undo");
      else if (action.kind === "redo") applyHistoryDirection("redo");
      else if (action.kind === "format") applyFormat(action.format);
    },
    [applyFormat, applyHistoryDirection, applyTextReplacement, readOnly]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const action = resolveEditorShortcutAction({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      });
      if (!action) return;
      e.preventDefault();
      if (action === "undo") applyHistoryDirection("undo");
      else if (action === "redo") applyHistoryDirection("redo");
      else if (action === "bold" || action === "italic") applyFormat(action);
      else if (action === "quickEdit") onToggleQuickEdit?.();
    },
    [applyFormat, applyHistoryDirection, onToggleQuickEdit]
  );

  useEffect(() => {
    const onDocSelectionChange = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const root = rootRef.current;
        if (!root || document.activeElement !== root) return;
        const offsets = readSelectionOffsets(root);
        if (!offsets) return;
        lastCaretRef.current = offsets;
        const text = contentRef.current.slice(offsets.start, offsets.end);
        onSelectionChange(
          offsets.end > offsets.start ? { start: offsets.start, end: offsets.end, text } : null
        );
      });
    };
    document.addEventListener("selectionchange", onDocSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onDocSelectionChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [onSelectionChange]);

  return {
    rootRef,
    isFocused,
    setIsFocused,
    setCaretRange: (start: number, end: number) => {
      lastCaretRef.current = { start, end };
    },
    applyFormat,
    handleBeforeInput,
    handleInput,
    handleKeyDown,
    onCompositionStart: () => {
      isComposingRef.current = true;
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
      handleInput();
    },
  };
}
