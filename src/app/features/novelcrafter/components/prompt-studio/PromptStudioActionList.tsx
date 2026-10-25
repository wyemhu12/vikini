// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionList.tsx
"use client";

import React from "react";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import {
  PROMPT_ACTION_GROUPS,
  type NovelcrafterPromptActionKey,
} from "@/lib/features/novelcrafter/promptActions";
import { cn } from "@/lib/utils/cn";
import { PROMPT_ACTION_LABELS, PROMPT_GROUP_LABELS } from "./promptStudioLabels";

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
      {PROMPT_ACTION_GROUPS.map((group) => (
        <div key={group.feature} className="space-y-1.5">
          <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-(--text-secondary)">
            {t(PROMPT_GROUP_LABELS[group.feature])}
          </h2>
          <div className="space-y-1">
            {group.keys.map((actionKey) => {
              const isSelected = selectedKey === actionKey;
              const isCustom = isActionCustomized(actionKey);
              return (
                <button
                  key={actionKey}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectKey(actionKey)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs md:text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                    isSelected
                      ? "bg-(--accent) text-(--accent-foreground) font-semibold shadow-xs"
                      : "text-(--text-primary) hover:bg-(--control-bg-hover)"
                  )}
                >
                  <span className="truncate">{t(PROMPT_ACTION_LABELS[actionKey])}</span>
                  {isCustom && (
                    <span
                      className={cn(
                        "shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        isSelected
                          ? "bg-(--surface)/25 text-(--accent-foreground)"
                          : "bg-(--accent)/15 text-(--accent) border border-(--accent)/30"
                      )}
                    >
                      {t("novelcrafterPromptStudioModified")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
