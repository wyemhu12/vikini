// /lib/features/novelcrafter/characterParser.ts
// Parses Markdown character profiles into structured StoryBibleCharacterCard items (UX-05)

import { MAX_CHARACTER_CARDS, type StoryBibleCharacterCard } from "./types";

const HEADING_REGEX = /(?:^|\n)#{2,3}\s+([^\n]+)\n/g;

export function parseCharacterCardsFromMarkdown(
  markdown: string,
  existingCount = 0
): StoryBibleCharacterCard[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const remainingSlots = Math.max(0, MAX_CHARACTER_CARDS - existingCount);
  if (remainingSlots === 0) return [];

  const matches = Array.from(trimmed.matchAll(HEADING_REGEX));
  if (matches.length === 0) return [];

  const cards: StoryBibleCharacterCard[] = [];
  for (let i = 0; i < matches.length && cards.length < remainingSlots; i += 1) {
    const match = matches[i];
    const rawHeader = (match[1] || "").replace(/^\*\*|\*\*$/g, "").trim();
    if (!rawHeader) continue;

    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx =
      i + 1 < matches.length ? (matches[i + 1].index ?? trimmed.length) : trimmed.length;
    const body = trimmed.slice(startIdx, endIdx).trim();

    let name = rawHeader;
    let role = "";
    const parenMatch = rawHeader.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const dashMatch = rawHeader.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    if (parenMatch) {
      name = parenMatch[1].trim();
      role = parenMatch[2].trim();
    } else if (dashMatch) {
      name = dashMatch[1].trim();
      role = dashMatch[2].trim();
    }

    const roleLineMatch = body.match(/^(?:[-*]\s*)?\*\*(?:Role|Vai trò)\*\*\s*:\s*([^\n]+)\n?/i);
    let traits = body;
    if (roleLineMatch && !role) {
      role = roleLineMatch[1].trim();
      traits = body.replace(roleLineMatch[0], "").trim();
    }

    cards.push({
      id: `char-${Date.now()}-${i + 1}`,
      name: name.slice(0, 150),
      role: role.slice(0, 150),
      traits: traits.slice(0, 4_000),
      visibleToAI: true,
    });
  }

  return cards;
}
