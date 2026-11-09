"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Lock, Search } from "lucide-react";
import { MODEL_FILTERS, buildModelPickerSections, type ModelFilter } from "@/lib/core/modelPicker";
import {
  SELECTABLE_MODELS,
  isStrataLocalModel,
  type SelectableModel,
} from "@/lib/core/modelRegistry";
import type { TranslationKey } from "@/lib/utils/config";
import { useRecentModelsStore } from "@/lib/store/recentModelsStore";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../hooks/useLanguage";
import type { LocalLlmStatus } from "../hooks/useLocalLlmHealth";
import LocalLlmStatusDot from "./LocalLlmStatusDot";

const FILTER_LABELS: Record<ModelFilter, TranslationKey> = {
  all: "modelFilterAll",
  fast: "modelFilterFast",
  reasoning: "modelFilterReasoning",
  free: "modelFilterFree",
  local: "modelFilterLocal",
};

interface ModelPickerListProps {
  currentModelId: string;
  isModelAllowed: (id: string) => boolean;
  isLocalVisible: boolean;
  localStatus: LocalLlmStatus;
  onSelect: (id: string) => void;
  onClose?: () => void;
  className?: string;
}

/** Searchable, filterable model listbox grouped by "recent" + provider (keyboard: ↑ ↓ Enter Esc). */
export default function ModelPickerList({
  currentModelId,
  isModelAllowed,
  isLocalVisible,
  localStatus,
  onSelect,
  onClose,
  className,
}: ModelPickerListProps) {
  const { t } = useLanguage();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ModelFilter>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const recentIds = useRecentModelsStore((s) => s.recentModelIds);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useRecentModelsStore.persist.rehydrate();
  }, []);

  const sections = useMemo(
    () =>
      buildModelPickerSections(SELECTABLE_MODELS, {
        recentIds,
        query,
        filter,
        isLocalVisible,
        describe: (m) => (m.descKey ? t(m.descKey) : ""),
      }),
    [recentIds, query, filter, isLocalVisible, t]
  );
  const flat = useMemo(() => sections.flatMap((s) => s.models), [sections]);
  const filters = MODEL_FILTERS.filter((f) => f !== "local" || isLocalVisible);

  const unavailableReason = (model: SelectableModel): string | null => {
    if (!isModelAllowed(model.id)) return t("modelLocked");
    if (isStrataLocalModel(model.id) && localStatus === "offline") return t("modelOfflineLocal");
    return null;
  };

  const choose = (model: SelectableModel | undefined) => {
    if (!model || unavailableReason(model)) return;
    onSelect(model.id);
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (flat.length ? (i + step + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[activeIndex]);
    } else if (e.key === "Escape" && onClose) {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  return (
    <div className={cn("flex min-h-0 flex-col", className)} onKeyDown={handleKeyDown}>
      <div className="shrink-0 space-y-2 border-b border-(--line) p-3">
        <label className="flex items-center gap-2 rounded-xl border border-(--line) bg-(--raised) px-3 focus-within:ring-2 focus-within:ring-(--ring)">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-(--muted)" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            data-focus-ring="container"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-label={t("modelPickerSearch")}
            placeholder={t("modelPickerSearch")}
            className="h-10 w-full bg-transparent text-sm text-(--text) placeholder:text-(--faint) outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setActiveIndex(0);
              }}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                filter === f
                  ? "border-transparent bg-(--soft) text-(--accent)"
                  : "border-(--line) text-(--muted) hover:text-(--text)"
              )}
            >
              {t(FILTER_LABELS[f])}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t("modelPickerList")}
        className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar"
      >
        {flat.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-(--muted)">{t("modelPickerEmpty")}</p>
        )}
        {sections.map((section) => (
          <div key={section.id} role="group" aria-label={section.label || t("modelGroupRecent")}>
            <p className="px-2 pb-1 pt-3 text-xs font-semibold text-(--faint)">
              {section.id === "recent" ? t("modelGroupRecent") : section.label}
            </p>
            {section.models.map((model) => {
              index += 1;
              const i = index;
              const reason = unavailableReason(model);
              const isCurrent = model.id === currentModelId;
              return (
                <div
                  key={`${section.id}-${model.id}`}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-disabled={reason ? true : undefined}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(model)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2",
                    i === activeIndex && "bg-(--raised)",
                    isCurrent && "bg-(--soft)",
                    reason && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isStrataLocalModel(model.id) && <LocalLlmStatusDot status={localStatus} />}
                      <span className="truncate text-sm font-medium text-(--text)">
                        {model.name ?? model.id}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-(--muted)">
                      {reason ?? (model.descKey ? t(model.descKey) : "")}
                    </p>
                  </div>
                  {reason ? (
                    <Lock aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 text-(--faint)" />
                  ) : (
                    isCurrent && (
                      <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-(--accent)" />
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="hidden shrink-0 items-center gap-3 border-t border-(--line) px-3 py-2 text-xs text-(--faint) md:flex">
        <span>
          <kbd className="font-mono">↑↓</kbd> {t("modelPickerHintMove")}
        </span>
        <span>
          <kbd className="font-mono">Enter</kbd> {t("modelPickerHintSelect")}
        </span>
        <span>
          <kbd className="font-mono">Esc</kbd> {t("modelPickerHintClose")}
        </span>
      </div>
    </div>
  );
}
