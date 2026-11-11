// /app/features/novelcrafter/components/StoryBibleStructuredCards.tsx
"use client";

import React, { useState } from "react";
import { ArrowUpRight, Eye, EyeOff, Pin, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { formatAliasesInput, parseAliasesInput } from "@/lib/features/novelcrafter/codexMatcher";
import {
  MAX_OUTLINE_ITEMS,
  MAX_WORLD_ELEMENTS,
  type StoryBible,
  type StoryBibleOutlineItem,
  type StoryBibleWorldElement,
} from "@/lib/features/novelcrafter/types";

export {
  StoryBibleCharacterCardsList,
  type StoryBibleCharactersSectionProps,
} from "./StoryBibleCharactersSection";

const INPUT_CLS =
  "w-full h-8 rounded-lg border border-(--line) bg-(--surface) px-2.5 text-xs text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:outline-none";

function createUid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface StructuredBibleSectionProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
}

export function StoryBibleWorldElementsList({
  storyBible,
  onUpdateStoryBible,
}: StructuredBibleSectionProps) {
  const { t } = useLanguage();
  const elements = storyBible.worldElements ?? [];
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, string>>({});

  const handleAdd = () => {
    if (elements.length >= MAX_WORLD_ELEMENTS) {
      toast.error(t("limitReached"));
      return;
    }
    const next: StoryBibleWorldElement = {
      id: createUid(),
      name: `${t("novelcrafterWorldbuildingLabel")} ${elements.length + 1}`,
      category: "",
      description: "",
      visibleToAI: true,
    };
    onUpdateStoryBible({ worldElements: [...elements, next] });
  };
  const handleUpdate = (id: string, patch: Partial<Omit<StoryBibleWorldElement, "id">>) => {
    onUpdateStoryBible({
      worldElements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };
  const commitAliasesDraft = (el: StoryBibleWorldElement) => {
    const raw = aliasDrafts[el.id];
    if (raw === undefined) return;
    const parsed = parseAliasesInput(raw);
    handleUpdate(el.id, { aliases: parsed.length > 0 ? parsed : undefined });
    setAliasDrafts((prev) => {
      const next = { ...prev };
      delete next[el.id];
      return next;
    });
  };
  const handleDelete = (id: string) => {
    onUpdateStoryBible({ worldElements: elements.filter((e) => e.id !== id) });
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-(--line)">
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--line) bg-(--raised) hover:border-(--muted) text-xs font-semibold text-(--accent) transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t("novelcrafterAddWorldElementBtn")}</span>
      </button>

      {elements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {elements.map((el) => {
            const aliasValue = aliasDrafts[el.id] ?? formatAliasesInput(el.aliases);
            return (
              <div
                key={el.id}
                data-testid={`world-element-${el.id}`}
                className="rounded-xl border border-(--line) bg-(--raised)/60 p-3 space-y-2"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={el.name}
                    onChange={(e) => handleUpdate(el.id, { name: e.target.value })}
                    placeholder={t("novelcrafterWorldElementNamePlaceholder")}
                    aria-label={t("novelcrafterWorldElementNamePlaceholder")}
                    className={`${INPUT_CLS} font-semibold`}
                  />
                  <input
                    type="text"
                    value={el.category}
                    onChange={(e) => handleUpdate(el.id, { category: e.target.value })}
                    placeholder={t("novelcrafterWorldElementCategoryPlaceholder")}
                    aria-label={t("novelcrafterWorldElementCategoryPlaceholder")}
                    className={`${INPUT_CLS} max-w-[130px]`}
                  />
                  <button
                    type="button"
                    aria-pressed={el.visibleToAI}
                    aria-label={
                      el.visibleToAI ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")
                    }
                    title={
                      el.visibleToAI ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")
                    }
                    onClick={() => handleUpdate(el.id, { visibleToAI: !el.visibleToAI })}
                    className={cn(
                      "p-1.5 rounded-lg border shrink-0 transition-colors",
                      el.visibleToAI
                        ? "border-(--line) text-(--accent) bg-(--soft)"
                        : "border-transparent text-(--faint) hover:bg-(--raised)"
                    )}
                  >
                    {el.visibleToAI ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(el.id)}
                    aria-label={t("delete")}
                    className="p-1.5 rounded-lg text-(--faint) hover:text-(--danger) hover:bg-(--danger)/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={aliasValue}
                    onChange={(e) =>
                      setAliasDrafts((prev) => ({ ...prev, [el.id]: e.target.value }))
                    }
                    onBlur={() => commitAliasesDraft(el)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitAliasesDraft(el);
                      }
                    }}
                    placeholder={t("novelcrafterCodexAliasesPlaceholder")}
                    aria-label={t("novelcrafterCodexAliasesPlaceholder")}
                    className={INPUT_CLS}
                  />
                  <button
                    type="button"
                    aria-pressed={Boolean(el.alwaysInclude)}
                    onClick={() => handleUpdate(el.id, { alwaysInclude: !el.alwaysInclude })}
                    title={
                      el.alwaysInclude
                        ? t("novelcrafterCodexAlwaysInclude")
                        : t("novelcrafterCodexAutoMatch")
                    }
                    aria-label={
                      el.alwaysInclude
                        ? t("novelcrafterCodexAlwaysInclude")
                        : t("novelcrafterCodexAutoMatch")
                    }
                    className={cn(
                      "inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-medium shrink-0 transition-colors",
                      el.alwaysInclude
                        ? "bg-(--soft) border-(--accent) text-(--accent)"
                        : "bg-(--surface) border-(--line) text-(--muted) hover:text-(--text)"
                    )}
                  >
                    <Pin className="w-3 h-3" />
                    <span className="hidden sm:inline">
                      {el.alwaysInclude
                        ? t("novelcrafterCodexAlwaysInclude")
                        : t("novelcrafterCodexAutoMatch")}
                    </span>
                  </button>
                </div>
                <input
                  type="text"
                  value={el.description}
                  onChange={(e) => handleUpdate(el.id, { description: e.target.value })}
                  placeholder={t("novelcrafterWorldElementDescPlaceholder")}
                  aria-label={t("novelcrafterWorldElementDescPlaceholder")}
                  className={INPUT_CLS}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface OutlineItemsSectionProps extends StructuredBibleSectionProps {
  onSendToChapterScenes?: (beats: string) => void;
}

export function StoryBibleOutlineItemsList({
  storyBible,
  onUpdateStoryBible,
  onSendToChapterScenes,
}: OutlineItemsSectionProps) {
  const { t } = useLanguage();
  const items = storyBible.outlineItems ?? [];

  const handleAdd = (type: "act" | "chapter") => {
    if (items.length >= MAX_OUTLINE_ITEMS) {
      toast.error(t("limitReached"));
      return;
    }
    const next: StoryBibleOutlineItem = {
      id: createUid(),
      type,
      title: `${type === "act" ? t("novelcrafterOutlineActPrefix") : t("novelcrafterChapterPrefix")} ${items.length + 1}`,
      summary: "",
    };
    onUpdateStoryBible({ outlineItems: [...items, next] });
  };
  const handleUpdate = (id: string, patch: Partial<Omit<StoryBibleOutlineItem, "id">>) => {
    onUpdateStoryBible({ outlineItems: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  };
  const handleDelete = (id: string) => {
    onUpdateStoryBible({ outlineItems: items.filter((i) => i.id !== id) });
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-(--line)">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleAdd("act")}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--line) bg-(--raised) hover:border-(--muted) text-xs font-semibold text-(--accent) transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("novelcrafterAddOutlineActBtn")}</span>
        </button>
        <button
          type="button"
          onClick={() => handleAdd("chapter")}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--line) bg-(--surface) hover:bg-(--raised) text-xs font-medium text-(--text) transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-(--accent)" />
          <span>{t("novelcrafterAddOutlineChapterBtn")}</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              data-testid={`outline-item-${item.id}`}
              className="rounded-xl border border-(--line) bg-(--raised)/60 p-3 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-(--surface) border border-(--line) text-xs font-bold uppercase text-(--accent) shrink-0">
                  {item.type === "act"
                    ? t("novelcrafterOutlineActPrefix")
                    : t("novelcrafterChapterPrefix")}
                </span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleUpdate(item.id, { title: e.target.value })}
                  placeholder={t("novelcrafterOutlineTitlePlaceholder")}
                  aria-label={t("novelcrafterOutlineTitlePlaceholder")}
                  className={`${INPUT_CLS} font-semibold`}
                />
                <button
                  type="button"
                  disabled={!item.summary.trim()}
                  onClick={() => onSendToChapterScenes?.(item.summary)}
                  aria-label={t("novelcrafterSendToChapterScenesBtn")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--soft) text-(--accent) hover:brightness-105 text-xs font-semibold shrink-0 disabled:opacity-40"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t("novelcrafterSendToChapterScenesBtn")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={t("delete")}
                  className="p-1.5 rounded-lg text-(--faint) hover:text-(--danger) hover:bg-(--danger)/10 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                rows={2}
                value={item.summary}
                onChange={(e) => handleUpdate(item.id, { summary: e.target.value })}
                placeholder={t("novelcrafterOutlineSummaryPlaceholder")}
                aria-label={t("novelcrafterOutlineSummaryPlaceholder")}
                className="w-full rounded-lg border border-(--line) bg-(--surface) px-2.5 py-1.5 text-xs text-(--text) placeholder:text-(--faint) focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:outline-none resize-y"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
