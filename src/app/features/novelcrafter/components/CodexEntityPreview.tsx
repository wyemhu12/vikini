// /app/features/novelcrafter/components/CodexEntityPreview.tsx
"use client";

import React from "react";
import { ArrowUpRight, BookUser, Eye, EyeOff, Globe2 } from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { StoryBible } from "@/lib/features/novelcrafter/types";

interface CodexEntityPreviewProps {
  entityId: string;
  entityKind: "character" | "world";
  storyBible: StoryBible;
  onOpenInBible: (kind: "character" | "world") => void;
}

export default function CodexEntityPreview({
  entityId,
  entityKind,
  storyBible,
  onOpenInBible,
}: CodexEntityPreviewProps) {
  const { t } = useLanguage();

  const character =
    entityKind === "character"
      ? (storyBible.characterCards ?? []).find((c) => c.id === entityId)
      : undefined;
  const worldElement =
    entityKind === "world"
      ? (storyBible.worldElements ?? []).find((w) => w.id === entityId)
      : undefined;

  const entity = character ?? worldElement;
  if (!entity) return null;

  const subtitle = character ? character.role : (worldElement?.category ?? "");
  const body = character ? character.traits : (worldElement?.description ?? "");
  const aliases = entity.aliases ?? [];
  const visibleToAI = entity.visibleToAI;

  return (
    <div data-testid="codex-entity-preview" className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-(--accent)">
          {entityKind === "character" ? (
            <BookUser className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Globe2 className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {entityKind === "character"
              ? t("novelcrafterCodexPreviewCharacter")
              : t("novelcrafterCodexPreviewWorld")}
          </span>
        </span>

        <span
          className={
            visibleToAI
              ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--success)/15 text-(--success) font-medium"
              : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--surface-muted) text-(--text-secondary) font-medium"
          }
        >
          {visibleToAI ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{visibleToAI ? t("novelcrafterVisibleToAI") : t("novelcrafterHiddenFromAI")}</span>
        </span>
      </div>

      <div>
        <div className="text-sm font-semibold text-(--text-primary)">{entity.name}</div>
        {subtitle && <div className="text-xs text-(--text-secondary) mt-0.5">{subtitle}</div>}
      </div>

      {aliases.length > 0 && (
        <div className="text-xs text-(--text-secondary)">
          <span className="font-medium text-(--text-primary)">
            {t("novelcrafterCodexAliasesLabel")}:{" "}
          </span>
          <span>{aliases.join(", ")}</span>
        </div>
      )}

      {body && (
        <p className="text-xs text-(--text-secondary) leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {body}
        </p>
      )}

      <div className="pt-1 border-t border-(--border)/60 flex justify-end">
        <button
          type="button"
          onClick={() => onOpenInBible(entityKind)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--border) text-xs font-medium text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
        >
          <span>{t("novelcrafterCodexJumpToBible")}</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-(--accent)" />
        </button>
      </div>
    </div>
  );
}
