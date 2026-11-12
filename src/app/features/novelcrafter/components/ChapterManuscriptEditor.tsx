// /app/features/novelcrafter/components/ChapterManuscriptEditor.tsx
"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { findQuoteRangeInText } from "@/lib/features/novelcrafter/feedbackParser";
import { isSafeDecorationId } from "@/lib/features/novelcrafter/manuscriptDecorations";
import type { ManuscriptFormat } from "@/lib/features/novelcrafter/manuscriptMarkup";
import type { ManuscriptTypography } from "@/lib/features/novelcrafter/manuscriptTypography";
import { computeQuoteScrollTop } from "@/lib/features/novelcrafter/quoteScrollPositioning";
import { findScrollParent } from "../utils/scrollParent";
import type {
  NovelcrafterFeedbackItem,
  NovelcrafterRewriteMode,
  StoryBible,
} from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import { createPortal } from "react-dom";
import { useManuscriptEditor, type EditorSelectionWithText } from "../hooks/useManuscriptEditor";
import { useSelectionBubblePosition } from "../hooks/useSelectionBubblePosition";
import { setSelectionOffsets } from "../utils/manuscriptDomOffsets";
import { MANUSCRIPT_SHEET_CLASS } from "../utils/manuscriptSheetClasses";
import ChapterSelectionToolbar, {
  type ChapterSelectionQuickEditProps,
} from "./ChapterSelectionToolbar";
import CodexEntityPreview from "./CodexEntityPreview";

export interface ManuscriptEditorHandle {
  applyFormat: (fmt: ManuscriptFormat) => void;
  scrollToFeedback: (feedbackId: string) => boolean;
  focusRange: (start: number, end: number) => void;
}

export interface ManuscriptBubbleHandlers {
  disabled?: boolean;
  onRewrite: (mode: NovelcrafterRewriteMode, label: string) => void;
  onDescribe: (label: string) => void;
  onExpand: (label: string) => void;
  onFeedback: (label: string) => void;
  quickEdit: ChapterSelectionQuickEditProps;
}

interface ChapterManuscriptEditorProps {
  chapterId: string;
  content: string;
  readOnly: boolean;
  typography: ManuscriptTypography;
  feedbackItems: readonly NovelcrafterFeedbackItem[];
  activeFeedbackId: string | null;
  storyBible: StoryBible;
  selection: EditorSelectionWithText | null;
  onChangeContent: (nextContent: string) => void;
  onSelectionChange: (selection: EditorSelectionWithText | null) => void;
  onFeedbackMarkClick: (feedbackId: string) => void;
  onOpenCodexEntity: (kind: "character" | "world") => void;
  bubble: ManuscriptBubbleHandlers;
  placeholder: string;
  ariaLabel: string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  feedbackMode?: "inline" | "bottom-sheet";
}

interface ActiveCodexPreviewState {
  entityId: string;
  entityKind: "character" | "world";
  top: number;
  left: number;
}

const FONT_FAMILY_CLASS: Record<ManuscriptTypography["fontFamily"], string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

const FONT_SIZE_CLASS: Record<ManuscriptTypography["fontSize"], string> = {
  sm: "text-[16px]",
  md: "text-[17px]",
  lg: "text-[19px]",
  xl: "text-[21px]",
};

const LINE_HEIGHT_CLASS: Record<ManuscriptTypography["lineHeight"], string> = {
  compact: "leading-[1.6]",
  normal: "leading-[1.8]",
  relaxed: "leading-[2.0]",
};

function escapeSelectorId(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

const ChapterManuscriptEditor = forwardRef<ManuscriptEditorHandle, ChapterManuscriptEditorProps>(
  function ChapterManuscriptEditor(
    {
      chapterId,
      content,
      readOnly,
      typography,
      feedbackItems,
      activeFeedbackId,
      storyBible,
      selection,
      onChangeContent,
      onSelectionChange,
      onFeedbackMarkClick,
      onOpenCodexEntity,
      bubble,
      placeholder,
      ariaLabel,
      scrollContainerRef,
      feedbackMode = "inline",
    },
    ref
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const codexAnchorRef = useRef<HTMLButtonElement | null>(null);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [activeCodexPreview, setActiveCodexPreview] = useState<ActiveCodexPreviewState | null>(
      null
    );

    const {
      rootRef,
      setIsFocused,
      setCaretRange,
      applyFormat,
      handleBeforeInput,
      handleInput,
      handleKeyDown,
      onCompositionStart,
      onCompositionEnd,
    } = useManuscriptEditor({
      chapterId,
      content,
      readOnly,
      feedbackItems,
      activeFeedbackId,
      storyBible,
      selection,
      onChangeContent,
      onSelectionChange,
      onToggleQuickEdit: bubble.quickEdit.onToggle,
    });

    useEffect(
      () => () => {
        if (hoverTimerRef.current !== null) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
      },
      []
    );

    useLayoutEffect(() => {
      const anchor = codexAnchorRef.current;
      if (!anchor || !activeCodexPreview) return;
      anchor.style.setProperty("--nc-codex-top", `${activeCodexPreview.top}px`);
      anchor.style.setProperty("--nc-codex-left", `${activeCodexPreview.left}px`);
    }, [activeCodexPreview]);

    const showBubble = Boolean(selection && selection.text.trim().length > 0 && !readOnly);
    const isDockedBubble =
      feedbackMode === "bottom-sheet" ||
      (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches);

    const floatingBubble = useSelectionBubblePosition({
      enabled: showBubble && !isDockedBubble,
      getSelectionRect: () => {
        const root = rootRef.current;
        if (!root) return null;
        const docSel = document.getSelection();
        if (docSel && docSel.rangeCount > 0 && root.contains(docSel.anchorNode)) {
          const rect = docSel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) return rect;
        }
        return root.querySelector<HTMLElement>(".nc-selection")?.getBoundingClientRect() ?? null;
      },
      getBoundaryRect: () => findScrollParent(rootRef.current)?.getBoundingClientRect() ?? null,
      bubbleWidth: 440,
      bubbleHeight: bubble.quickEdit.open ? 88 : 44,
      updateKey: `${selection?.start ?? -1}:${selection?.end ?? -1}:${bubble.quickEdit.open}`,
    });

    useImperativeHandle(
      ref,
      () => ({
        applyFormat,
        focusRange: (start: number, end: number) => {
          const root = rootRef.current;
          if (!root) return;
          root.focus({ preventScroll: true });
          setIsFocused(true);
          setCaretRange(start, end);
          setSelectionOffsets(root, start, end);
          onSelectionChange(end > start ? { start, end, text: content.slice(start, end) } : null);
        },
        scrollToFeedback: (feedbackId: string) => {
          const root = rootRef.current;
          if (!root || !isSafeDecorationId(feedbackId)) return false;
          const item = feedbackItems.find((f) => f.id === feedbackId);
          const range = item
            ? findQuoteRangeInText(content, item.quote) ||
              (item.suggestion ? findQuoteRangeInText(content, item.suggestion) : null)
            : null;
          const markEl = root.querySelector<HTMLElement>(
            `[data-feedback-id="${escapeSelectorId(feedbackId)}"]`
          );
          if (!markEl && !range) return false;

          if (range) {
            root.focus({ preventScroll: true });
            setIsFocused(true);
            setCaretRange(range.start, range.end);
            setSelectionOffsets(root, range.start, range.end);
            onSelectionChange({
              start: range.start,
              end: range.end,
              text: content.slice(range.start, range.end),
            });
          }

          const targetEl = markEl ?? root.querySelector<HTMLElement>(".nc-selection");
          const outer = scrollContainerRef?.current ?? null;
          const container = findScrollParent(targetEl) ?? outer;
          if (container && targetEl) {
            const targetTop = computeQuoteScrollTop({
              targetRectTop: targetEl.getBoundingClientRect().top,
              containerRectTop: container.getBoundingClientRect().top,
              containerScrollTop: container.scrollTop,
              containerClientHeight: container.clientHeight,
            });
            container.scrollTo({ top: targetTop, behavior: "smooth" });
            // Inner manuscript box: also bring the box itself into the outer viewport.
            if (container !== outer && typeof container.scrollIntoView === "function") {
              container.scrollIntoView({ block: "nearest" });
            }
          }
          return true;
        },
      }),
      [
        applyFormat,
        content,
        feedbackItems,
        onSelectionChange,
        rootRef,
        scrollContainerRef,
        setCaretRange,
        setIsFocused,
      ]
    );

    const openCodexForSpan = (codexEl: HTMLElement) => {
      const entityId = codexEl.dataset.codexId;
      const entityKind = codexEl.dataset.codexKind;
      const wrapper = wrapperRef.current;
      if (!entityId || (entityKind !== "character" && entityKind !== "world") || !wrapper) {
        return;
      }
      const spanRect = codexEl.getBoundingClientRect();
      const wrapRect = wrapper.getBoundingClientRect();
      setActiveCodexPreview({
        entityId,
        entityKind,
        top: Math.max(0, spanRect.bottom - wrapRect.top),
        left: Math.max(0, spanRect.left - wrapRect.left),
      });
    };

    const bubbleProps = {
      disabled: bubble.disabled,
      onRewrite: bubble.onRewrite,
      onDescribe: bubble.onDescribe,
      onExpand: bubble.onExpand,
      onFeedback: bubble.onFeedback,
      quickEdit: bubble.quickEdit,
    };

    return (
      <div ref={wrapperRef} className={cn("relative", MANUSCRIPT_SHEET_CLASS)}>
        {showBubble && isDockedBubble && (
          <ChapterSelectionToolbar placement="docked-bottom" {...bubbleProps} />
        )}
        {showBubble &&
          !isDockedBubble &&
          floatingBubble &&
          createPortal(
            <ChapterSelectionToolbar placement={floatingBubble} {...bubbleProps} />,
            document.body
          )}

        <Popover
          open={Boolean(activeCodexPreview)}
          onOpenChange={(open) => {
            if (!open) setActiveCodexPreview(null);
          }}
        >
          <PopoverTrigger asChild>
            <button
              ref={codexAnchorRef}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute top-(--nc-codex-top) left-(--nc-codex-left) w-1 h-1 opacity-0"
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-3.5">
            {activeCodexPreview && (
              <CodexEntityPreview
                entityId={activeCodexPreview.entityId}
                entityKind={activeCodexPreview.entityKind}
                storyBible={storyBible}
                onOpenInBible={(kind) => {
                  setActiveCodexPreview(null);
                  onOpenCodexEntity(kind);
                }}
              />
            )}
          </PopoverContent>
        </Popover>

        <div
          id="nc-manuscript"
          ref={rootRef}
          contentEditable={readOnly ? "false" : "plaintext-only"}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-readonly={readOnly}
          aria-label={ariaLabel}
          spellCheck
          data-nc-manuscript="true"
          data-testid="chapter-manuscript-editor"
          data-placeholder={content.length === 0 ? placeholder : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onBeforeInput={handleBeforeInput}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onClick={(e) => {
            const target = e.target instanceof HTMLElement ? e.target : null;
            if (!target) return;
            const fbEl = target.closest<HTMLElement>("[data-feedback-id]");
            if (fbEl?.dataset.feedbackId) {
              onFeedbackMarkClick(fbEl.dataset.feedbackId);
              return;
            }
            const codexEl = target.closest<HTMLElement>("[data-codex-id]");
            if (codexEl) {
              openCodexForSpan(codexEl);
            }
          }}
          onMouseMove={(e) => {
            if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
            const target = e.target instanceof HTMLElement ? e.target : null;
            const codexEl = target?.closest<HTMLElement>("[data-codex-id]");
            if (!codexEl) return;
            if (
              typeof window !== "undefined" &&
              typeof window.matchMedia === "function" &&
              !window.matchMedia("(pointer: fine)").matches
            ) {
              return;
            }
            hoverTimerRef.current = setTimeout(() => {
              hoverTimerRef.current = null;
              openCodexForSpan(codexEl);
            }, 300);
          }}
          onMouseLeave={() => {
            if (hoverTimerRef.current !== null) {
              clearTimeout(hoverTimerRef.current);
              hoverTimerRef.current = null;
            }
          }}
          className={cn(
            "min-h-[420px] whitespace-pre-wrap break-words tracking-[-0.005em] antialiased text-(--text) focus:outline-none",
            FONT_FAMILY_CLASS[typography.fontFamily],
            FONT_SIZE_CLASS[typography.fontSize],
            LINE_HEIGHT_CLASS[typography.lineHeight],
            typography.paragraphIndent && "[&_.nc-paragraph]:indent-[1.5em]",
            content.length === 0 &&
              "before:content-[attr(data-placeholder)] before:text-(--muted)/70 before:pointer-events-none before:float-left before:h-0",
            "[&_.nc-line]:min-h-[1.6em]",
            "[&_.nc-line:not(:last-child)_br]:hidden",
            "[&_.nc-blank]:min-h-[0.85em] [&_.nc-blank]:leading-[0.85]",
            "[&_.nc-h1]:text-[1.55em] [&_.nc-h1]:font-semibold [&_.nc-h1]:leading-[1.3] [&_.nc-h1]:mt-4 [&_.nc-h1]:mb-2",
            "[&_.nc-h2]:text-[1.3em] [&_.nc-h2]:font-semibold [&_.nc-h2]:leading-[1.35] [&_.nc-h2]:mt-3 [&_.nc-h2]:mb-1.5",
            "[&_.nc-sceneBreak]:text-center [&_.nc-sceneBreak]:tracking-[0.5em] [&_.nc-sceneBreak]:text-(--muted) [&_.nc-sceneBreak]:my-4",
            "[&_.nc-marker]:opacity-15 [&:focus-within_.nc-marker]:opacity-40 [&_.nc-marker]:text-[0.88em] [&_.nc-marker]:font-normal",
            "[&_.nc-bold]:font-bold",
            "[&_.nc-italic]:italic",
            "[&_.nc-strike]:line-through [&_.nc-strike]:opacity-75",
            "[&_.nc-feedback]:bg-(--warning)/15 [&_.nc-feedback]:text-(--text) [&_.nc-feedback]:underline [&_.nc-feedback]:decoration-(--warning) [&_.nc-feedback]:decoration-2 [&_.nc-feedback]:underline-offset-4 [&_.nc-feedback]:rounded-xs [&_.nc-feedback]:cursor-pointer",
            "[&_.nc-feedback-active]:bg-(--warning)/30",
            "[&_.nc-codex]:underline [&_.nc-codex]:decoration-dotted [&_.nc-codex]:decoration-(--accent) [&_.nc-codex]:underline-offset-4 [&_.nc-codex]:cursor-help",
            "[&_.nc-selection]:bg-(--accent)/25 [&_.nc-selection]:rounded-xs"
          )}
        />
      </div>
    );
  }
);

export default ChapterManuscriptEditor;
