// /app/features/novelcrafter/hooks/useManuscriptEditor.ts
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  findCodexMentionRanges,
  type CodexMentionRange,
} from "@/lib/features/novelcrafter/codexMatcher";
import {
  buildFeedbackDecorations,
  buildRenderLines,
  type ManuscriptDecoration,
  type RenderLine,
} from "@/lib/features/novelcrafter/manuscriptDecorations";
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
  buildLineElement,
  deriveDomLineSignature,
  readSelectionOffsets,
  serializeManuscriptRoot,
  setSelectionOffsets,
  type ManuscriptSelectionRange,
} from "../utils/manuscriptDomOffsets";

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

function reconcileDomLines(
  root: HTMLElement,
  renderLines: readonly RenderLine[],
  caret: ManuscriptSelectionRange | null
): void {
  const doc = root.ownerDocument ?? document;
  for (let i = 0; i < renderLines.length; i += 1) {
    const line = renderLines[i];
    const existing = root.children[i] as HTMLElement | undefined;
    if (
      existing &&
      (existing.dataset.sig === line.signature ||
        deriveDomLineSignature(existing) === line.signature)
    ) {
      existing.dataset.sig = line.signature;
      existing.dataset.line = String(i);
      existing.dataset.block = line.block;
      continue;
    }
    const nextEl = buildLineElement(doc, line);
    if (existing) {
      root.replaceChild(nextEl, existing);
    } else {
      root.appendChild(nextEl);
    }
  }

  while (root.children.length > renderLines.length) {
    const last = root.lastElementChild;
    if (!last) break;
    root.removeChild(last);
  }

  if (caret && doc.activeElement === root) {
    setSelectionOffsets(root, caret.start, caret.end);
  }
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

  const decorations = useMemo<ManuscriptDecoration[]>(() => {
    const list = buildFeedbackDecorations(content, feedbackItems, activeFeedbackId);
    for (const c of codexRanges) {
      list.push({
        kind: "codex",
        entityId: c.entityId,
        entityKind: c.entityKind,
        start: c.start,
        end: c.end,
      });
    }
    if (!isFocused && selection && selection.end > selection.start) {
      list.push({ kind: "selection", start: selection.start, end: selection.end });
    }
    return list;
  }, [content, feedbackItems, activeFeedbackId, codexRanges, isFocused, selection]);

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
      const normalized = insertedText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const current = contentRef.current;
      const sel = readSelectionOffsets(root) ?? lastCaretRef.current;
      const nextContent = `${current.slice(0, sel.start)}${normalized}${current.slice(sel.end)}`;
      const nextCaret = sel.start + normalized.length;
      commitModelChange(nextContent, nextCaret, nextCaret, normalized.length <= 2);
    },
    [commitModelChange, readOnly]
  );

  const performUndo = useCallback(() => {
    if (readOnly) return;
    const res = undoHistory(historyRef.current, {
      content: contentRef.current,
      selectionStart: lastCaretRef.current.start,
      selectionEnd: lastCaretRef.current.end,
      at: Date.now(),
    });
    if (!res.entry) return;
    historyRef.current = res.state;
    lastEmittedRef.current = res.entry.content;
    lastCaretRef.current = { start: res.entry.selectionStart, end: res.entry.selectionEnd };
    onChangeContent(res.entry.content);
  }, [onChangeContent, readOnly]);

  const performRedo = useCallback(() => {
    if (readOnly) return;
    const res = redoHistory(historyRef.current, {
      content: contentRef.current,
      selectionStart: lastCaretRef.current.start,
      selectionEnd: lastCaretRef.current.end,
      at: Date.now(),
    });
    if (!res.entry) return;
    historyRef.current = res.state;
    lastEmittedRef.current = res.entry.content;
    lastCaretRef.current = { start: res.entry.selectionStart, end: res.entry.selectionEnd };
    onChangeContent(res.entry.content);
  }, [onChangeContent, readOnly]);

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
      const type = native.inputType;
      if (type === "insertParagraph" || type === "insertLineBreak") {
        e.preventDefault();
        applyTextReplacement("\n");
      } else if (type === "insertFromPaste" || type === "insertFromDrop") {
        e.preventDefault();
        const text = native.dataTransfer?.getData("text/plain") ?? "";
        if (text) applyTextReplacement(text);
      } else if (type === "historyUndo") {
        e.preventDefault();
        performUndo();
      } else if (type === "historyRedo") {
        e.preventDefault();
        performRedo();
      } else if (type === "formatBold") {
        e.preventDefault();
        applyFormat("bold");
      } else if (type === "formatItalic") {
        e.preventDefault();
        applyFormat("italic");
      } else if (type === "formatStrikeThrough") {
        e.preventDefault();
        applyFormat("strike");
      }
    },
    [applyFormat, applyTextReplacement, performRedo, performUndo, readOnly]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        performRedo();
      } else if (key === "b") {
        e.preventDefault();
        applyFormat("bold");
      } else if (key === "i") {
        e.preventDefault();
        applyFormat("italic");
      } else if (key === "k") {
        e.preventDefault();
        onToggleQuickEdit?.();
      }
    },
    [applyFormat, onToggleQuickEdit, performRedo, performUndo]
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
