// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionList.tsx
"use client";

import React from "react";
import {
  BookOpen,
  Expand,
  Lightbulb,
  MessageSquareQuote,
  PenLine,
  WandSparkles,
} from "lucide-react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import {
  getDefaultContextNodes,
  PROMPT_ACTION_GROUPS,
  type NovelcrafterPromptActionKey,
} from "@/lib/features/novelcrafter/promptActions";
import type { NovelcrafterFeatureSlot } from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import { PROMPT_ACTION_LABELS, PROMPT_GROUP_LABELS } from "./promptStudioLabels";

const GROUP_ICONS: Record<NovelcrafterFeatureSlot, React.ComponentType<{ className?: string }>> = {
  bible: BookOpen,
  write: PenLine,
  rewrite: WandSparkles,
  feedback: MessageSquareQuote,
  expand: Expand,
  brainstorm: Lightbulb,
};

interface PromptStudioActionListProps {
  selectedKey: NovelcrafterPromptActionKey;
  onSelectKey: (key: NovelcrafterPromptActionKey) => void;
  isActionCustomized: (key: NovelcrafterPromptActionKey) => boolean;
}

export default function PromptStudioActionList({
  selectedKey,
  onSelectKey,
  isActionCustomized,
}: PromptStudioActionListProps) {
  const { t } = useLanguage();

  return (
    <aside className="rounded-2xl border border-(--border) bg-(--surface-elevated)/60 p-3.5 space-y-4 overflow-y-auto max-h-[calc(100dvh-13rem)] custom-scrollbar">
      {PROMPT_ACTION_GROUPS.map((group) => {
        const GroupIcon = GROUP_ICONS[group.feature];
        const isPipeline = group.feature === "bible";
        return (
          <div
            key={group.feature}
            className="rounded-xl border border-(--border) bg-(--surface-muted)/50 p-2.5 space-y-2"
          >
            <div className="px-2.5 py-1.5 rounded-lg bg-(--accent)/15 border border-(--accent)/30 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-(--accent) truncate">
                <GroupIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t(PROMPT_GROUP_LABELS[group.feature])}</span>
              </h2>
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-(--surface)/80 text-xs font-semibold text-(--accent)">
                {group.keys.length}
              </span>
            </div>
            {isPipeline && (
              <p className="px-2 text-xs text-(--text-secondary)">
                {t("novelcrafterPromptStudioPipelineHint")}
              </p>
            )}
            <div className="ml-2.5 pl-2.5 border-l-2 border-(--accent)/35 space-y-1">
              {group.keys.map((actionKey, idx) => {
                const isSelected = selectedKey === actionKey;
                const isCustom = isActionCustomized(actionKey);
                const nodeCount = getDefaultContextNodes(actionKey).length;
                return (
                  <button
                    key={actionKey}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectKey(actionKey)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      isSelected
                        ? "bg-(--accent) text-(--accent-foreground) font-semibold shadow-xs"
                        : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border",
                          isSelected
                            ? "bg-(--surface)/20 border-(--accent-foreground)/40 text-(--accent-foreground)"
                            : "bg-(--surface-elevated) border-(--border) text-(--accent)"
                        )}
                      >
                        {isPipeline ? idx + 1 : "•"}
                      </span>
                      <span className="truncate">{t(PROMPT_ACTION_LABELS[actionKey])}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {isCustom && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-(--warning)/20 text-(--warning)">
                          {t("novelcrafterPromptStudioModified")}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded-md text-xs font-mono bg-(--surface-elevated)/80 text-(--text-secondary)">
                        {nodeCount}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
