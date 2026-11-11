// /app/features/novelcrafter/components/StoryBibleCharactersSection.tsx
"use client";

import React, { useState } from "react";
import { EyeOff, Plus, Sparkles } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { computeCharacterMentions } from "@/lib/features/novelcrafter/characterMentions";
import { parseCharacterCardsFromMarkdown } from "@/lib/features/novelcrafter/characterParser";
import {
  MAX_CHARACTER_CARDS,
  type NovelcrafterChapter,
  type StoryBible,
  type StoryBibleCharacterCard,
} from "@/lib/features/novelcrafter/types";
import StoryBibleCharacterPanel, { getCharacterInitial } from "./StoryBibleCharacterPanel";

function createUid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface StoryBibleCharactersSectionProps {
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  chapters?: readonly Pick<
    NovelcrafterChapter,
    "id" | "title" | "content" | "scenes" | "summary"
  >[];
  selectedCharacterId?: string | null;
  onSelectCharacter?: (id: string | null) => void;
  onOpenChapter?: (chapterId: string) => void;
  renderInlinePanel?: boolean;
}

export function StoryBibleCharacterCardsList({
  storyBible,
  onUpdateStoryBible,
  chapters = [],
  selectedCharacterId,
  onSelectCharacter,
  onOpenChapter,
  renderInlinePanel = false,
}: StoryBibleCharactersSectionProps) {
  const { t } = useLanguage();
  const cards = storyBible.characterCards ?? [];
  const hasFreeNotes = storyBible.characters.trim().length > 0;
  const [uncontrolledId, setUncontrolledId] = useState<string | null>(null);

  const activeId = selectedCharacterId !== undefined ? selectedCharacterId : uncontrolledId;
  const selectCharacter = (nextId: string | null) => {
    if (onSelectCharacter) {
      onSelectCharacter(nextId);
    } else {
      setUncontrolledId(nextId);
    }
  };

  const handleAdd = () => {
    if (cards.length >= MAX_CHARACTER_CARDS) {
      toast.error(t("limitReached"));
      return;
    }
    const next: StoryBibleCharacterCard = {
      id: createUid(),
      name: `${t("novelcrafterBrainstormCharacters")} ${cards.length + 1}`,
      role: "",
      traits: "",
      visibleToAI: true,
    };
    onUpdateStoryBible({ characterCards: [...cards, next] });
    selectCharacter(next.id);
  };

  const handleUpdate = (id: string, patch: Partial<Omit<StoryBibleCharacterCard, "id">>) => {
    onUpdateStoryBible({
      characterCards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const handleDelete = (id: string) => {
    onUpdateStoryBible({ characterCards: cards.filter((c) => c.id !== id) });
    if (activeId === id) {
      selectCharacter(null);
    }
  };

  const handleParse = () => {
    if (cards.length >= MAX_CHARACTER_CARDS) {
      toast.error(t("limitReached"));
      return;
    }
    const parsed = parseCharacterCardsFromMarkdown(storyBible.characters);
    if (parsed.length === 0) return;
    const existing = new Set(cards.map((c) => c.name.trim().toLowerCase()));
    const fresh = parsed.filter((p) => !existing.has(p.name.trim().toLowerCase()));
    if (fresh.length === 0) return;
    const merged = [...cards, ...fresh].slice(0, MAX_CHARACTER_CARDS);
    if (cards.length + fresh.length > MAX_CHARACTER_CARDS) {
      toast.error(t("limitReached"));
    }
    onUpdateStoryBible({ characterCards: merged });
    if (fresh[0]) selectCharacter(fresh[0].id);
  };

  const activeCard = activeId ? (cards.find((c) => c.id === activeId) ?? null) : null;

  return (
    <div className="space-y-3 pt-2 border-t border-(--line)">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-(--accent) text-(--on-accent) hover:brightness-105 text-xs font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("novelcrafterAddCharacterCardBtn")}</span>
        </button>

        {hasFreeNotes && (
          <button
            type="button"
            onClick={handleParse}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-(--line) bg-(--surface) hover:bg-(--raised) text-xs font-medium text-(--text) transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
            <span>{t("novelcrafterParseCardsFromNotesBtn")}</span>
          </button>
        )}
      </div>

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((card) => {
            const isSelected = activeId === card.id;
            const summaryLine =
              (card.traits || "").trim() ||
              (card.appearance || "").trim() ||
              (card.relationships || "").trim() ||
              t("novelcrafterCharacterCardNoSummary");
            const mentionSummary = computeCharacterMentions(
              { name: card.name, aliases: card.aliases },
              chapters
            );
            const proseChapters = mentionSummary.items.filter((m) => m.proseCount > 0).length;
            const metaText =
              proseChapters > 0
                ? t("novelcrafterCharacterCardMentionsMeta")
                    .replace("{chapters}", String(proseChapters))
                    .replace("{count}", String(mentionSummary.totalProseCount))
                : mentionSummary.items.length > 0
                  ? t("novelcrafterCharacterCardOutlineOnlyMeta").replace(
                      "{chapters}",
                      String(mentionSummary.items.length)
                    )
                  : "";

            return (
              <button
                key={card.id}
                type="button"
                data-testid={`character-card-${card.id}`}
                aria-pressed={isSelected}
                onClick={() => selectCharacter(card.id)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl bg-(--surface) border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                  isSelected
                    ? "border-(--accent) ring-1 ring-(--accent)/30"
                    : "border-(--line) hover:border-(--muted)"
                )}
              >
                <span
                  aria-hidden="true"
                  className="w-11 h-11 shrink-0 rounded-xl bg-(--raised) text-(--accent) font-serif text-[22px] flex items-center justify-center"
                >
                  {getCharacterInitial(card.name)}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[15px] font-semibold text-(--text) truncate">
                      {card.name}
                    </span>
                    {card.role && (
                      <span className="text-xs text-(--faint) truncate">{card.role}</span>
                    )}
                    {card.visibleToAI === false && (
                      <EyeOff
                        className="w-3.5 h-3.5 text-(--faint) shrink-0 ml-auto"
                        aria-label={t("novelcrafterHiddenFromAI")}
                      />
                    )}
                  </div>
                  <span className="text-xs md:text-[13px] leading-relaxed text-(--muted) line-clamp-2">
                    {summaryLine}
                  </span>
                  {metaText && <span className="text-xs text-(--faint)">{metaText}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {renderInlinePanel && activeCard && (
        <div className="rounded-2xl border border-(--line) bg-(--surface)">
          <StoryBibleCharacterPanel
            card={activeCard}
            chapters={chapters}
            onUpdateCard={(patch) => handleUpdate(activeCard.id, patch)}
            onDeleteCard={() => handleDelete(activeCard.id)}
            onClose={() => selectCharacter(null)}
            onOpenChapter={onOpenChapter}
          />
        </div>
      )}
    </div>
  );
}
