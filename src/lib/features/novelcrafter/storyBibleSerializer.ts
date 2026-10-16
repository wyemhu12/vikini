// /lib/features/novelcrafter/storyBibleSerializer.ts
// Combines structured Story Bible cards with free-form notes for AI prompt context (UX-05)

import type { StoryBible } from "./types";

export function serializeStoryBibleWithStructuredCards(bible: StoryBible): {
  charactersText: string;
  worldbuildingText: string;
  outlineText: string;
} {
  const visibleCharCards = (bible.characterCards || [])
    .filter((c) => c.visibleToAI !== false)
    .map((c) => `### ${c.name}${c.role ? ` (${c.role})` : ""}\n${c.traits ? c.traits.trim() : ""}`)
    .join("\n\n");

  const charactersText = [visibleCharCards, bible.characters.trim()].filter(Boolean).join("\n\n");

  const visibleWorldElements = (bible.worldElements || [])
    .filter((w) => w.visibleToAI !== false)
    .map(
      (w) =>
        `### ${w.name}${w.category ? ` [${w.category}]` : ""}\n${w.description ? w.description.trim() : ""}`
    )
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
