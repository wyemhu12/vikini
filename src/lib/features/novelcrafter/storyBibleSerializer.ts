// /lib/features/novelcrafter/storyBibleSerializer.ts
// Combines structured Story Bible cards with free-form notes for AI prompt context (UX-05)

import { isCodexCardMatchedInContext } from "./codexMatcher";
import type { StoryBible } from "./types";

export function escapeXmlPromptText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function unescapeXmlPromptText(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export interface SerializeStoryBibleOptions {
  activeContextText?: string;
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
    .map((c) => {
      const aliasesLine =
        c.aliases && c.aliases.length > 0 ? `\nAliases: ${c.aliases.join(", ")}` : "";
      return `### ${c.name}${c.role ? ` (${c.role})` : ""}${aliasesLine}\n${c.traits ? c.traits.trim() : ""}`;
    })
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
