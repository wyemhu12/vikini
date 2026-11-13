// /app/features/novelcrafter/components/prompt-studio/PromptStudioActionList.tsx
"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  PROMPT_ACTION_GROUPS,
  type NovelcrafterPromptActionKey,
} from "@/lib/features/novelcrafter/promptActions";
import type { NovelcrafterFeatureSlot } from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { PROMPT_SIDEBAR_ACTION_LABELS, PROMPT_SIDEBAR_GROUP_LABELS } from "./promptStudioLabels";

interface PromptStudioActionListProps {
  selectedKey: NovelcrafterPromptActionKey;
  onSelectKey: (key: NovelcrafterPromptActionKey) => void;
  isActionCustomized: (key: NovelcrafterPromptActionKey) => boolean;
}

function getGroupForAction(key: NovelcrafterPromptActionKey): NovelcrafterFeatureSlot {
  return PROMPT_ACTION_GROUPS.find((g) => g.keys.includes(key))?.feature ?? "bible";
}

export default function PromptStudioActionList({
  selectedKey,
  onSelectKey,
  isActionCustomized,
}: PromptStudioActionListProps) {
  const { t } = useLanguage();
  const baseId = useId();
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<NovelcrafterFeatureSlot>>(
    () => new Set([getGroupForAction(selectedKey)])
  );
  const [prevSelectedKey, setPrevSelectedKey] = useState<NovelcrafterPromptActionKey>(selectedKey);

  if (prevSelectedKey !== selectedKey) {
    setPrevSelectedKey(selectedKey);
    const nextGroup = getGroupForAction(selectedKey);
    if (!expandedGroups.has(nextGroup)) {
      const next = new Set(expandedGroups);
      next.add(nextGroup);
      setExpandedGroups(next);
    }
  }

  const toggleGroup = (feature: NovelcrafterFeatureSlot) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) {
        next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  };

  const visibleKeys = useMemo(
    () => PROMPT_ACTION_GROUPS.filter((g) => expandedGroups.has(g.feature)).flatMap((g) => g.keys),
    [expandedGroups]
  );

  const focusableKey = visibleKeys.includes(selectedKey) ? selectedKey : (visibleKeys[0] ?? null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target || target.getAttribute("role") !== "option" || visibleKeys.length === 0) {
      return;
    }

    const focusedKey = target.getAttribute("data-action-key") as NovelcrafterPromptActionKey | null;
    const anchorIndex = focusedKey ? visibleKeys.indexOf(focusedKey) : -1;
    if (anchorIndex === -1) return;

    let nextIndex = -1;
    if (e.key === "ArrowDown") {
      nextIndex = Math.min(visibleKeys.length - 1, anchorIndex + 1);
    } else if (e.key === "ArrowUp") {
      nextIndex = Math.max(0, anchorIndex - 1);
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = visibleKeys.length - 1;
    }

    if (nextIndex !== -1 && nextIndex !== anchorIndex) {
      e.preventDefault();
      const nextKey = visibleKeys[nextIndex];
      if (nextKey) {
        onSelectKey(nextKey);
        optionRefs.current[nextKey]?.focus();
      }
    }
  };

  return (
    <nav
      aria-label={t("novelcrafterPromptStudioActionsAria")}
      onKeyDown={handleKeyDown}
      className="w-full md:w-64 lg:w-72 shrink-0 p-2.5 border-b md:border-b-0 md:border-r border-(--line) bg-(--bg)/40 flex flex-col gap-1.5 max-h-60 md:max-h-none overflow-y-auto custom-scrollbar"
    >
      <h2 className="sr-only">{t("novelcrafterPromptStudioActionsAria")}</h2>

      {PROMPT_ACTION_GROUPS.map((group) => {
        const groupLabel = t(PROMPT_SIDEBAR_GROUP_LABELS[group.feature]);
        const isExpanded = expandedGroups.has(group.feature);
        const groupBtnId = `${baseId}-group-btn-${group.feature}`;
        const groupListId = `${baseId}-group-list-${group.feature}`;
        const customizedCount = group.keys.filter((k) => isActionCustomized(k)).length;
        const containsSelected = group.keys.includes(selectedKey);

        return (
          <div key={group.feature} className="flex flex-col gap-0.5">
            <button
              type="button"
              id={groupBtnId}
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? groupListId : undefined}
              onClick={() => toggleGroup(group.feature)}
              className={cn(
                "w-full h-8.5 px-2.5 rounded-lg flex items-center justify-between gap-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                containsSelected && !isExpanded
                  ? "bg-(--soft) text-(--text) ring-1 ring-(--accent)/45"
                  : "text-(--text) hover:bg-(--raised)"
              )}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-(--muted) shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-(--muted) shrink-0" />
                )}
                <span className="truncate">{groupLabel}</span>
              </span>

              {customizedCount > 0 ? (
                <span
                  aria-label={`${customizedCount} ${t("novelcrafterPromptStudioModified")}`}
                  className="px-1.5 py-0.5 rounded-full bg-(--soft) text-(--text) ring-1 ring-(--accent)/40 font-mono text-xs leading-none shrink-0"
                >
                  {customizedCount}
                </span>
              ) : (
                <span className="font-mono text-xs text-(--faint) shrink-0">
                  {group.keys.length}
                </span>
              )}
            </button>

            {isExpanded && (
              <div
                id={groupListId}
                role="listbox"
                aria-labelledby={groupBtnId}
                className="pl-3 ml-2 border-l border-(--line) flex flex-col gap-0.5 py-0.5"
              >
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
                      data-action-key={actionKey}
                      aria-selected={isSelected}
                      tabIndex={actionKey === focusableKey ? 0 : -1}
                      onClick={() => onSelectKey(actionKey)}
                      className={cn(
                        "w-full min-h-8.5 px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                        isSelected
                          ? "bg-(--soft) text-(--text) ring-1 ring-(--accent)/45 font-semibold"
                          : "text-(--muted) hover:text-(--text) hover:bg-(--raised)"
                      )}
                    >
                      <span className="leading-snug break-words">
                        {t(PROMPT_SIDEBAR_ACTION_LABELS[actionKey])}
                      </span>
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
            )}
          </div>
        );
      })}
    </nav>
  );
}
