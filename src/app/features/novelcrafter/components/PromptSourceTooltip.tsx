// /app/features/novelcrafter/components/PromptSourceTooltip.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { BookOpen, FileText, GitBranch, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import {
  resolvePromptSourceSummary,
  type PromptFixedInputKind,
} from "@/lib/features/novelcrafter/promptSourceSummary";
import {
  ensurePromptStudioHydrated,
  usePromptStudioStore,
} from "@/lib/features/novelcrafter/promptStudioStore";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { cn } from "@/lib/utils/cn";
import { CONTEXT_NODE_LABELS, PROMPT_ACTION_LABELS } from "./prompt-studio/promptStudioLabels";

const FIXED_INPUT_LABELS: Record<PromptFixedInputKind, TranslationKey> = {
  braindump: "novelcrafterTooltipFixedBraindump",
  selected_text: "novelcrafterTooltipFixedSelectedText",
  current_section: "novelcrafterTooltipFixedCurrentSection",
  guided_notes: "novelcrafterTooltipFixedKeyDetails",
};

export interface PromptSourceTooltipProps {
  actionKey: NovelcrafterPromptActionKey;
  actionMode?: NovelcrafterActionMode;
  bibleTarget?: NovelcrafterBibleTarget;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

export function PromptSourceTooltip({
  actionKey,
  actionMode,
  bibleTarget,
  children,
  side = "top",
  align = "center",
  disabled = false,
}: PromptSourceTooltipProps) {
  const { t } = useLanguage();
  const settings = usePromptStudioStore((s) => s.settings);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void ensurePromptStudioHydrated();
    const handleSync = () => {
      void ensurePromptStudioHydrated();
    };
    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const summary = useMemo(
    () =>
      resolvePromptSourceSummary(actionKey, settings, {
        actionMode,
        bibleTarget,
      }),
    [actionKey, settings, actionMode, bibleTarget]
  );

  const isOpen = !disabled && open;
  const actionLabelKey = PROMPT_ACTION_LABELS[summary.actionKey];

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root
        open={isOpen}
        onOpenChange={(next) => {
          if (disabled) {
            setOpen(false);
            return;
          }
          setOpen(next);
        }}
      >
        <TooltipPrimitive.Trigger
          asChild
          onMouseEnter={() => {
            if (!disabled) setOpen(true);
          }}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
        >
          {children}
        </TooltipPrimitive.Trigger>
        {isOpen && (
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={side}
              align={align}
              sideOffset={6}
              collisionPadding={12}
              className="z-(--z-popover) w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-(--border) bg-(--surface-elevated) p-3 text-(--text-primary) shadow-xl pointer-events-none select-none space-y-2.5 animate-in fade-in-0 zoom-in-95"
            >
              <div className="flex items-start justify-between gap-2 border-b border-(--border) pb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-primary)">
                    <Sparkles className="w-3.5 h-3.5 text-(--accent) shrink-0" />
                    <span className="truncate">{t(actionLabelKey)}</span>
                  </div>
                  <p className="text-xs text-(--text-secondary) mt-0.5">
                    {t("novelcrafterTooltipSourcesTitle")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold border",
                      summary.isCustomized
                        ? "bg-(--accent)/15 border-(--accent)/40 text-(--accent)"
                        : "bg-(--surface-muted) border-(--border) text-(--text-secondary)"
                    )}
                  >
                    {summary.isCustomized
                      ? t("novelcrafterPromptStudioCustomizedBadge")
                      : t("novelcrafterPromptStudioDefaultBadge")}
                  </span>
                  {summary.hasCustomDirective && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-(--accent)/10 text-(--accent)">
                      {t("novelcrafterTooltipCustomDirectiveBadge")}
                    </span>
                  )}
                </div>
              </div>

              {summary.fixedInputs.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-(--text-secondary)">
                    <GitBranch className="w-3 h-3 text-(--accent) shrink-0" />
                    <span>{t("novelcrafterTooltipFixedInputs")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {summary.fixedInputs.map((input) => (
                      <span
                        key={input}
                        className="px-2 py-0.5 rounded-md border border-(--accent)/40 bg-(--accent)/15 text-xs font-medium text-(--accent)"
                      >
                        {t(FIXED_INPUT_LABELS[input])}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.storyBibleNodes.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-(--text-secondary)">
                    <BookOpen className="w-3 h-3 text-(--accent) shrink-0" />
                    <span>{t("novelcrafterTooltipStoryBible")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {summary.storyBibleNodes.map((node) => (
                      <span
                        key={node}
                        className="px-2 py-0.5 rounded-md border border-(--border) bg-(--surface-muted) text-xs font-medium text-(--text-primary)"
                      >
                        {t(CONTEXT_NODE_LABELS[node])}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.chapterContextNodes.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-(--text-secondary)">
                    <FileText className="w-3 h-3 text-(--accent) shrink-0" />
                    <span>{t("novelcrafterTooltipChapterContext")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {summary.chapterContextNodes.map((node) => (
                      <span
                        key={node}
                        className="px-2 py-0.5 rounded-md border border-(--border) bg-(--surface-muted) text-xs font-medium text-(--text-primary)"
                      >
                        {t(CONTEXT_NODE_LABELS[node])}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-1 border-t border-(--border) flex items-center justify-between text-xs text-(--text-secondary)">
                <span>{t("novelcrafterTooltipPromptStudioHint")}</span>
              </div>
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export default PromptSourceTooltip;
