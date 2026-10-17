// /app/features/novelcrafter/components/StoryBibleStructuredCards.tsx
"use client";

import React from "react";
import { ArrowUpRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { parseCharacterCardsFromMarkdown } from "@/lib/features/novelcrafter/characterParser";
import type {
  StoryBible,
  StoryBibleCharacterCard,
  StoryBibleOutlineItem,
  StoryBibleWorldElement,
} from "@/lib/features/novelcrafter/types";

const INPUT_CLS =
  "w-full h-8 rounded-lg border border-(--border) bg-(--surface) px-2.5 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none";

function createUid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CharacterCardsSectionProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
}

export function StoryBibleCharacterCardsList({
  storyBible,
  onUpdateStoryBible,
}: CharacterCardsSectionProps) {
  const { t } = useLanguage();
  const cards = storyBible.characterCards ?? [];
  const hasFreeNotes = storyBible.characters.trim().length > 0;

  const handleAdd = () => {
    const next: StoryBibleCharacterCard = {
      id: createUid(),
      name: `${t("novelcrafterBrainstormCharacters")} ${cards.length + 1}`,
      role: "",
      traits: "",
      visibleToAI: true,
    };
    onUpdateStoryBible({ characterCards: [...cards, next] });
  };
  const handleUpdate = (id: string, patch: Partial<Omit<StoryBibleCharacterCard, "id">>) => {
    onUpdateStoryBible({
      characterCards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };
  const handleDelete = (id: string) => {
    onUpdateStoryBible({ characterCards: cards.filter((c) => c.id !== id) });
  };
  const handleParse = () => {
    const parsed = parseCharacterCardsFromMarkdown(storyBible.characters);
    if (parsed.length === 0) return;
    const existing = new Set(cards.map((c) => c.name.trim().toLowerCase()));
    const fresh = parsed.filter((p) => !existing.has(p.name.trim().toLowerCase()));
    if (fresh.length > 0) onUpdateStoryBible({ characterCards: [...cards, ...fresh] });
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-(--border)/60">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--accent) transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("novelcrafterAddCharacterCardBtn")}</span>
        </button>

        {hasFreeNotes && (
          <button
            type="button"
            onClick={handleParse}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--border) bg-(--surface-elevated) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterParseCardsFromNotesBtn")}</span>
          </button>
        )}
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {cards.map((card) => (
            <div
              key={card.id}
              data-testid={`character-card-${card.id}`}
              className="rounded-xl border border-(--border) bg-(--surface-elevated)/70 p-3 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={card.name}
                  onChange={(e) => handleUpdate(card.id, { name: e.target.value })}
                  placeholder={t("novelcrafterCharacterNamePlaceholder")}
                  aria-label={t("novelcrafterCharacterNamePlaceholder")}
                  className={`${INPUT_CLS} font-semibold`}
                />
                <input
                  type="text"
                  value={card.role}
                  onChange={(e) => handleUpdate(card.id, { role: e.target.value })}
                  placeholder={t("novelcrafterCharacterRolePlaceholder")}
                  aria-label={t("novelcrafterCharacterRolePlaceholder")}
                  className={`${INPUT_CLS} max-w-[140px]`}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(card.id)}
                  aria-label={t("delete")}
                  className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={card.traits}
                onChange={(e) => handleUpdate(card.id, { traits: e.target.value })}
                placeholder={t("novelcrafterCharacterTraitsPlaceholder")}
                aria-label={t("novelcrafterCharacterTraitsPlaceholder")}
                className={INPUT_CLS}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StoryBibleWorldElementsList({
  storyBible,
  onUpdateStoryBible,
}: CharacterCardsSectionProps) {
  const { t } = useLanguage();
  const elements = storyBible.worldElements ?? [];

  const handleAdd = () => {
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
  const handleDelete = (id: string) => {
    onUpdateStoryBible({ worldElements: elements.filter((e) => e.id !== id) });
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-(--border)/60">
      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--accent) transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t("novelcrafterAddWorldElementBtn")}</span>
      </button>

      {elements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {elements.map((el) => (
            <div
              key={el.id}
              data-testid={`world-element-${el.id}`}
              className="rounded-xl border border-(--border) bg-(--surface-elevated)/70 p-3 space-y-2"
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
                  onClick={() => handleDelete(el.id)}
                  aria-label={t("delete")}
                  className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
          ))}
        </div>
      )}
    </div>
  );
}

interface OutlineItemsSectionProps extends CharacterCardsSectionProps {
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
    const next: StoryBibleOutlineItem = {
      id: createUid(),
      type,
      title: `${type === "act" ? "Act" : t("novelcrafterChaptersTab")} ${items.length + 1}`,
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
    <div className="space-y-2.5 pt-2 border-t border-(--border)/60">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handleAdd("act")}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--accent) transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("novelcrafterAddOutlineActBtn")}</span>
        </button>
        <button
          type="button"
          onClick={() => handleAdd("chapter")}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--border) bg-(--surface-elevated) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) transition-colors"
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
              className="rounded-xl border border-(--border) bg-(--surface-elevated)/70 p-3 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-(--control-bg) border border-(--border) text-xs font-bold uppercase text-(--accent) shrink-0">
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--accent)/15 text-(--accent) hover:bg-(--accent)/25 text-xs font-semibold shrink-0 disabled:opacity-40"
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
                  className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--danger) hover:bg-(--danger)/10 shrink-0"
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
                className="w-full rounded-lg border border-(--border) bg-(--surface) px-2.5 py-1.5 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
