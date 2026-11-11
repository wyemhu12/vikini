// /app/features/novelcrafter/components/StoryBibleCharacterPanel.tsx
"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Eye, EyeOff, Pin, Trash2, X } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { computeCharacterMentions } from "@/lib/features/novelcrafter/characterMentions";
import { formatAliasesInput, parseAliasesInput } from "@/lib/features/novelcrafter/codexMatcher";
import { CHARACTER_DETAIL_MAX_CHARS } from "@/lib/features/novelcrafter/storyBibleLimits";
import {
  isCharacterFieldVisibleToAi,
  type CharacterDetailField,
} from "@/lib/features/novelcrafter/storyBibleSerializer";
import type {
  NovelcrafterChapter,
  StoryBibleCharacterCard,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";

export function getCharacterInitial(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  return last[0] ? last[0].toUpperCase() : "?";
}

interface FieldDescriptor {
  key: CharacterDetailField;
  visibilityProp:
    | "appearanceVisibleToAI"
    | "traitsVisibleToAI"
    | "relationshipsVisibleToAI"
    | "secretVisibleToAI";
  labelKey: TranslationKey;
  placeholderKey: TranslationKey;
}

const CHARACTER_FIELDS: readonly FieldDescriptor[] = [
  {
    key: "appearance",
    visibilityProp: "appearanceVisibleToAI",
    labelKey: "novelcrafterCharacterFieldAppearance",
    placeholderKey: "novelcrafterCharacterFieldAppearancePlaceholder",
  },
  {
    key: "traits",
    visibilityProp: "traitsVisibleToAI",
    labelKey: "novelcrafterCharacterFieldTraits",
    placeholderKey: "novelcrafterCharacterTraitsPlaceholder",
  },
  {
    key: "relationships",
    visibilityProp: "relationshipsVisibleToAI",
    labelKey: "novelcrafterCharacterFieldRelationships",
    placeholderKey: "novelcrafterCharacterFieldRelationshipsPlaceholder",
  },
  {
    key: "secret",
    visibilityProp: "secretVisibleToAI",
    labelKey: "novelcrafterCharacterFieldSecret",
    placeholderKey: "novelcrafterCharacterFieldSecretPlaceholder",
  },
];

export interface StoryBibleCharacterPanelProps {
  card: StoryBibleCharacterCard;
  chapters?: readonly Pick<
    NovelcrafterChapter,
    "id" | "title" | "content" | "scenes" | "summary"
  >[];
  onUpdateCard: (patch: Partial<Omit<StoryBibleCharacterCard, "id">>) => void;
  onDeleteCard: () => void;
  onClose?: () => void;
  onOpenChapter?: (chapterId: string) => void;
}

export default function StoryBibleCharacterPanel({
  card,
  chapters = [],
  onUpdateCard,
  onDeleteCard,
  onClose,
  onOpenChapter,
}: StoryBibleCharacterPanelProps) {
  const { t } = useLanguage();
  const baseId = useId();
  const [aliasDraft, setAliasDraft] = useState<string>(() => formatAliasesInput(card.aliases));

  useEffect(() => {
    setAliasDraft(formatAliasesInput(card.aliases));
  }, [card.id, card.aliases]);

  const commitAliases = () => {
    const parsed = parseAliasesInput(aliasDraft);
    onUpdateCard({ aliases: parsed.length > 0 ? parsed : undefined });
    setAliasDraft(formatAliasesInput(parsed));
  };

  const mentions = useMemo(
    () => computeCharacterMentions({ name: card.name, aliases: card.aliases }, chapters),
    [card.name, card.aliases, chapters]
  );

  const inputCls =
    "w-full h-8 rounded-lg border border-(--line) bg-(--bg) px-2.5 text-xs text-(--text) placeholder:text-(--faint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)";

  return (
    <div className="p-5 flex flex-col gap-4 w-full text-(--text)">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="w-14 h-14 rounded-2xl bg-(--soft) text-(--accent) font-serif text-[28px] flex items-center justify-center shrink-0"
        >
          {getCharacterInitial(card.name)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-2xl text-(--text) leading-tight truncate">{card.name}</p>
          <p className="text-xs text-(--faint) mt-0.5 truncate">
            {card.role || t("novelcrafterCharacterRolePlaceholder")}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-pressed={card.visibleToAI}
            aria-label={
              card.visibleToAI ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")
            }
            title={card.visibleToAI ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")}
            onClick={() => onUpdateCard({ visibleToAI: !card.visibleToAI })}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              card.visibleToAI
                ? "border-(--line) text-(--accent) bg-(--soft)"
                : "border-(--line) text-(--faint) bg-(--raised)"
            )}
          >
            {card.visibleToAI ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDeleteCard}
            aria-label={t("delete")}
            className="p-1.5 rounded-lg text-(--faint) hover:text-(--danger) hover:bg-(--danger)/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="p-1.5 rounded-lg text-(--faint) hover:text-(--text) hover:bg-(--raised) transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={card.name}
          onChange={(e) => onUpdateCard({ name: e.target.value })}
          placeholder={t("novelcrafterCharacterNamePlaceholder")}
          aria-label={t("novelcrafterCharacterNamePlaceholder")}
          className={cn(inputCls, "font-semibold")}
        />
        <input
          type="text"
          value={card.role}
          onChange={(e) => onUpdateCard({ role: e.target.value })}
          placeholder={t("novelcrafterCharacterRolePlaceholder")}
          aria-label={t("novelcrafterCharacterRolePlaceholder")}
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            onBlur={commitAliases}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAliases();
              }
            }}
            placeholder={t("novelcrafterCodexAliasesPlaceholder")}
            aria-label={t("novelcrafterCodexAliasesPlaceholder")}
            className={inputCls}
          />
          <button
            type="button"
            aria-pressed={Boolean(card.alwaysInclude)}
            aria-label={
              card.alwaysInclude
                ? t("novelcrafterCodexAlwaysInclude")
                : t("novelcrafterCodexAutoMatch")
            }
            onClick={() => onUpdateCard({ alwaysInclude: !card.alwaysInclude })}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-medium shrink-0 transition-colors",
              card.alwaysInclude
                ? "bg-(--soft) border-(--accent) text-(--accent)"
                : "bg-(--raised) border-(--line) text-(--muted) hover:text-(--text)"
            )}
          >
            <Pin className="w-3 h-3" />
            <span>
              {card.alwaysInclude
                ? t("novelcrafterCodexAlwaysInclude")
                : t("novelcrafterCodexAutoMatch")}
            </span>
          </button>
        </div>
        {card.aliases && card.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.aliases.map((alias) => (
              <span
                key={alias}
                className="text-xs px-2 py-0.5 rounded-md bg-(--raised) text-(--muted)"
              >
                {alias}
              </span>
            ))}
          </div>
        )}
      </div>

      {CHARACTER_FIELDS.map((field) => {
        const visible = isCharacterFieldVisibleToAi(card, field.key);
        const value = (card[field.key] ?? "") as string;
        const fieldId = `${baseId}-${field.key}`;
        return (
          <div
            key={field.key}
            data-testid={`character-field-${field.key}`}
            className="flex flex-col gap-1.5 pb-3 border-b border-(--line)"
          >
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={fieldId} className="text-xs font-semibold text-(--faint)">
                {t(field.labelKey)}
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={`${t(field.labelKey)}: ${
                  visible ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")
                }`}
                onClick={() => onUpdateCard({ [field.visibilityProp]: !visible })}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2 rounded-md border text-xs font-medium transition-colors",
                  visible
                    ? "border-(--line) bg-transparent text-(--muted) hover:text-(--text)"
                    : "border-(--accent)/40 bg-(--soft) text-(--accent)"
                )}
              >
                {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>
                  {visible ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")}
                </span>
              </button>
            </div>
            <textarea
              id={fieldId}
              rows={2}
              maxLength={CHARACTER_DETAIL_MAX_CHARS}
              value={value}
              onChange={(e) => onUpdateCard({ [field.key]: e.target.value })}
              placeholder={t(field.placeholderKey)}
              className={cn(
                "w-full rounded-lg border border-(--line) bg-(--bg) px-3 py-2 text-xs md:text-sm leading-relaxed placeholder:text-(--faint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) resize-y",
                visible ? "text-(--text)" : "text-(--muted)"
              )}
            />
          </div>
        );
      })}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-(--faint)">
          {t("novelcrafterCharacterMentionsLabel")}
        </span>
        {mentions.items.length === 0 ? (
          <p className="text-xs text-(--faint)">{t("novelcrafterCharacterMentionsEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mentions.items.map((item) => {
              const isProse = item.proseCount > 0;
              const label = isProse
                ? t("novelcrafterCharacterChapterChip")
                    .replace("{chapter}", String(item.chapterNumber))
                    .replace("{count}", String(item.proseCount))
                : t("novelcrafterCharacterOutlineChip").replace(
                    "{chapter}",
                    String(item.chapterNumber)
                  );
              const testId = isProse
                ? `character-mention-prose-${item.chapterId}`
                : `character-mention-outline-${item.chapterId}`;
              return (
                <button
                  key={`${item.chapterId}-${isProse ? "prose" : "outline"}`}
                  type="button"
                  data-testid={testId}
                  onClick={() => onOpenChapter?.(item.chapterId)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-(--line) bg-(--bg) text-(--text) hover:border-(--accent) hover:bg-(--soft) transition-colors"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function StoryBibleCharacterSheet({
  card,
  chapters,
  onUpdateCard,
  onDeleteCard,
  onClose,
  onOpenChapter,
}: StoryBibleCharacterPanelProps & { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        hideCloseButton
        className="overflow-y-auto custom-scrollbar bg-(--surface) border-(--line)"
      >
        <SheetTitle className="sr-only">
          {`${t("novelcrafterCharacterDetailLabel")} ${card.name}`}
        </SheetTitle>
        <SheetDescription className="sr-only">{t("novelcrafterCharactersDesc")}</SheetDescription>
        <StoryBibleCharacterPanel
          card={card}
          chapters={chapters}
          onUpdateCard={onUpdateCard}
          onDeleteCard={onDeleteCard}
          onClose={onClose}
          onOpenChapter={(chapterId) => {
            onClose();
            onOpenChapter?.(chapterId);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
