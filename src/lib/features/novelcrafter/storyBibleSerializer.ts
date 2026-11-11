// /lib/features/novelcrafter/storyBibleSerializer.ts
// Combines structured Story Bible cards with free-form notes for AI prompt context (UX-05 / 5C)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type { StoryBible, StoryBibleCharacterCard } from "./types";

export type CharacterDetailField = "appearance" | "traits" | "relationships" | "secret";

export function isCharacterFieldVisibleToAi(
  card: Pick<
    StoryBibleCharacterCard,
    "appearanceVisibleToAI" | "traitsVisibleToAI" | "relationshipsVisibleToAI" | "secretVisibleToAI"
  >,
  field: CharacterDetailField
): boolean {
  if (field === "secret") return card.secretVisibleToAI === true;
  if (field === "appearance") return card.appearanceVisibleToAI !== false;
  if (field === "relationships") return card.relationshipsVisibleToAI !== false;
  return card.traitsVisibleToAI !== false;
}

export function escapeXmlPromptText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function unescapeXmlPromptText(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export interface SerializeStoryBibleOptions {
  activeContextText?: string;
}

function serializeCharacterCard(c: StoryBibleCharacterCard): string {
  const aliasesLine = c.aliases && c.aliases.length > 0 ? `\nAliases: ${c.aliases.join(", ")}` : "";
  const header = `### ${c.name}${c.role ? ` (${c.role})` : ""}${aliasesLine}`;

  const appearance = isCharacterFieldVisibleToAi(c, "appearance")
    ? (c.appearance ?? "").trim()
    : "";
  const traits = isCharacterFieldVisibleToAi(c, "traits") ? (c.traits ?? "").trim() : "";
  const relationships = isCharacterFieldVisibleToAi(c, "relationships")
    ? (c.relationships ?? "").trim()
    : "";
  const secret = isCharacterFieldVisibleToAi(c, "secret") ? (c.secret ?? "").trim() : "";

  const hasMultiFields = Boolean(appearance || relationships || secret);
  if (!hasMultiFields) {
    return `${header}\n${traits}`;
  }

  const lines: string[] = [];
  if (appearance) lines.push(`Appearance: ${appearance}`);
  if (traits) lines.push(`Traits: ${traits}`);
  if (relationships) lines.push(`Relationships: ${relationships}`);
  if (secret) lines.push(`Secret: ${secret}`);
  return lines.length > 0 ? `${header}\n${lines.join("\n")}` : header;
}

export function serializeStoryBibleWithStructuredCards(
  bible: StoryBible,
  options?: SerializeStoryBibleOptions
): {
  charactersText: string;
  worldbuildingText: string;
  outlineText: string;
} {
  const visibleCharCards = (bible.characterCards || [])
    .filter((c) => isCodexCardMatchedInContext(c, options?.activeContextText))
    .map(serializeCharacterCard)
    .join("\n\n");

  const charactersText = [visibleCharCards, bible.characters.trim()].filter(Boolean).join("\n\n");

  const visibleWorldElements = (bible.worldElements || [])
    .filter((w) => isCodexCardMatchedInContext(w, options?.activeContextText))
    .map((w) => {
      const aliasesLine =
        w.aliases && w.aliases.length > 0 ? `\nAliases: ${w.aliases.join(", ")}` : "";
      return `### ${w.name}${w.category ? ` [${w.category}]` : ""}${aliasesLine}\n${w.description ? w.description.trim() : ""}`;
    })
    .join("\n\n");

  const worldbuildingText = [visibleWorldElements, bible.worldbuilding.trim()]
    .filter(Boolean)
    .join("\n\n");

  const structuredOutline = (bible.outlineItems || [])
    .map((item) =>
      item.type === "act"
        ? `## ${item.title}\n${item.summary.trim()}`
        : `### ${item.title}\n${item.summary.trim()}`
    )
    .join("\n\n");

  const outlineText = [structuredOutline, bible.outline.trim()].filter(Boolean).join("\n\n");

  return { charactersText, worldbuildingText, outlineText };
}
