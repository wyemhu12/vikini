// /app/features/novelcrafter/components/ChapterSelectionToolbar.tsx
"use client";

import React, { useLayoutEffect, useRef } from "react";
import { ChevronDown, Eye, Maximize2, MessageSquareQuote, RefreshCw, Wand2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { SelectionBubblePlacement } from "@/lib/features/novelcrafter/selectionBubblePlacement";
import type { NovelcrafterRewriteMode } from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";

export interface ChapterSelectionQuickEditProps {
  open: boolean;
  prompt: string;
  onToggle: () => void;
  onChangePrompt: (prompt: string) => void;
  onSubmit: () => void;
}

export interface ChapterSelectionToolbarProps {
  placement: SelectionBubblePlacement | "docked-bottom";
  disabled?: boolean;
  onRewrite: (mode: NovelcrafterRewriteMode, label: string) => void;
  onDescribe: (label: string) => void;
  onExpand: (label: string) => void;
  onFeedback: (label: string) => void;
  quickEdit: ChapterSelectionQuickEditProps;
}

export default function ChapterSelectionToolbar({
  placement,
  disabled = false,
  onRewrite,
  onDescribe,
  onExpand,
  onFeedback,
  quickEdit,
}: ChapterSelectionToolbarProps) {
  const { t } = useLanguage();
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el || placement === "docked-bottom") return;
    el.style.setProperty("--nc-bubble-top", `${placement.top}px`);
    el.style.setProperty("--nc-bubble-left", `${placement.left}px`);
  }, [placement]);

  const handleToolbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const el = toolbarRef.current;
    if (!el) return;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    if (buttons.length === 0) return;
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    e.preventDefault();
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;
    buttons[nextIdx]?.focus();
  };

  const rewritePresets: { mode: NovelcrafterRewriteMode; label: string }[] = [
    { mode: "rephrase", label: t("novelcrafterRewriteRephrase") },
    { mode: "show_dont_tell", label: t("novelcrafterRewriteShowDontTell") },
    { mode: "shorter", label: t("novelcrafterRewriteShorter") },
    { mode: "more_descriptive", label: t("novelcrafterRewriteMoreDescriptive") },
    { mode: "more_inner_conflict", label: t("novelcrafterRewriteInnerConflict") },
    { mode: "more_intense", label: t("novelcrafterRewriteMoreIntense") },
  ];

  const btnCls =
    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none disabled:opacity-50 shrink-0";

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label={t("novelcrafterSelectionToolbarAria")}
      data-testid="chapter-selection-toolbar"
      onKeyDown={handleToolbarKeyDown}
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
        }
      }}
      className={cn(
        "z-(--z-popover) w-max max-w-[calc(100vw-2rem)] rounded-xl border border-(--accent)/40 bg-(--surface-elevated)/95 backdrop-blur-md p-1.5 shadow-lg",
        placement === "docked-bottom"
          ? "sticky bottom-[calc(var(--nc-kb-offset,0px)+0.75rem)] mx-auto mt-2"
          : "absolute top-(--nc-bubble-top) left-(--nc-bubble-left)"
      )}
    >
      <div className="flex items-center gap-1 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={disabled} className={btnCls}>
              <RefreshCw className="w-3.5 h-3.5 text-(--accent)" />
              <span>{t("novelcrafterSlotRewrite")}</span>
              <ChevronDown className="w-3 h-3 text-(--text-secondary)" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {rewritePresets.map((preset) => (
              <DropdownMenuItem
                key={preset.mode}
                onSelect={() => onRewrite(preset.mode, preset.label)}
              >
                {preset.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onDescribe(t("novelcrafterDescribeAll"))}
          className={btnCls}
        >
          <Eye className="w-3.5 h-3.5 text-(--accent)" />
          <span>{t("novelcrafterBubbleDescribeBtn")}</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onExpand(t("novelcrafterExpandPassage"))}
          className={btnCls}
        >
          <Maximize2 className="w-3.5 h-3.5 text-(--accent)" />
          <span>{t("novelcrafterBubbleExpandBtn")}</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onFeedback(t("novelcrafterFeedbackLine"))}
          className={btnCls}
        >
          <MessageSquareQuote className="w-3.5 h-3.5 text-(--warning)" />
          <span>{t("novelcrafterBubbleFeedbackBtn")}</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          aria-pressed={quickEdit.open}
          onClick={quickEdit.onToggle}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--accent)/15 border border-(--accent)/40 hover:bg-(--accent)/25 text-xs font-semibold text-(--accent) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none disabled:opacity-50 shrink-0"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>{t("novelcrafterQuickEditBtn")}</span>
        </button>
      </div>

      {quickEdit.open && (
        <div className="mt-1.5 pt-1.5 border-t border-(--border) flex items-center gap-1.5">
          <input
            type="text"
            value={quickEdit.prompt}
            onChange={(e) => quickEdit.onChangePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                quickEdit.onSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                quickEdit.onToggle();
              }
            }}
            autoFocus
            placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
            aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
            className="flex-1 min-w-48 h-7 rounded-md bg-(--surface) border border-(--border) px-2 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none focus:border-(--accent)"
          />
          <button
            type="button"
            disabled={disabled || !quickEdit.prompt.trim()}
            onClick={quickEdit.onSubmit}
            className="px-2.5 py-1 rounded-md bg-(--accent) text-(--accent-foreground) text-xs font-semibold transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            {t("novelcrafterQuickEditSubmitBtn")}
          </button>
        </div>
      )}
    </div>
  );
}
