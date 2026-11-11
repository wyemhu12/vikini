// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionList.tsx
"use client";

import React, { useMemo, useRef } from "react";
import {
  PROMPT_ACTION_GROUPS,
  type NovelcrafterPromptActionKey,
} from "@/lib/features/novelcrafter/promptActions";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../../chat/hooks/useLanguage";
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
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const allKeys = useMemo(() => PROMPT_ACTION_GROUPS.flatMap((g) => g.keys), []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = allKeys.indexOf(selectedKey);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === "ArrowDown") {
      nextIndex = Math.min(allKeys.length - 1, currentIndex + 1);
    } else if (e.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = allKeys.length - 1;
    }

    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      e.preventDefault();
      const nextKey = allKeys[nextIndex];
      if (nextKey) {
        onSelectKey(nextKey);
        optionRefs.current[nextKey]?.focus();
      }
    }
  };

  return (
    <div
      role="listbox"
      aria-label={t("novelcrafterPromptStudioActionsAria")}
      onKeyDown={handleKeyDown}
      className="w-full sm:w-42 shrink-0 p-2 border-b sm:border-b-0 sm:border-r border-(--line) flex flex-col gap-3 max-h-48 sm:max-h-none overflow-y-auto custom-scrollbar"
    >
      {PROMPT_ACTION_GROUPS.map((group) => {
        const groupLabel = t(PROMPT_GROUP_LABELS[group.feature]);
        return (
          <div
            key={group.feature}
            role="group"
            aria-label={groupLabel}
            className="flex flex-col gap-0.5"
          >
            <div className="px-2.5 py-1 text-xs font-semibold text-(--faint) truncate">
              {groupLabel}
            </div>
            {group.keys.map((actionKey) => {
              const isSelected = selectedKey === actionKey;
              const isCustom = isActionCustomized(actionKey);
              return (
                <button
                  key={actionKey}
                  ref={(el) => {
                    optionRefs.current[actionKey] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onSelectKey(actionKey)}
                  className={cn(
                    "w-full h-8.5 px-2.5 rounded-lg text-left text-xs flex items-center justify-between gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                    isSelected
                      ? "bg-(--soft) text-(--accent) font-medium"
                      : "text-(--muted) hover:text-(--text) hover:bg-(--raised)"
                  )}
                >
                  <span className="truncate">{t(PROMPT_ACTION_LABELS[actionKey])}</span>
                  {isCustom && (
                    <span
                      aria-label={t("novelcrafterPromptStudioModified")}
                      title={t("novelcrafterPromptStudioModified")}
                      className="w-1.5 h-1.5 rounded-full bg-(--accent) shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
