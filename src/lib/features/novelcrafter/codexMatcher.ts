// /lib/features/novelcrafter/codexMatcher.ts
// Unicode word-boundary Codex alias & context auto-matching for Novelcrafter Studio (Phase 3.1)

import { MAX_CODEX_ALIASES, MAX_CODEX_ALIAS_CHARS, type StoryBible } from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CJK_SCRIPT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function parseAliasesInput(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  const parts = raw.split(/[,;\n]+/);
  const result: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parts.length && result.length < MAX_CODEX_ALIASES; i += 1) {
    const trimmed = parts[i].trim().slice(0, MAX_CODEX_ALIAS_CHARS).trim();
    if (!trimmed) continue;
    const key = trimmed.normalize("NFC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function formatAliasesInput(aliases?: readonly string[]): string {
  if (!aliases || aliases.length === 0) return "";
  return aliases.join(", ");
}

export function doesCodexTermMatchContext(term: string, contextText: string): boolean {
  const normalizedTerm = term.trim().normalize("NFC");
  const normalizedContext = contextText.normalize("NFC");
  if (normalizedTerm.length < 2 || !normalizedContext.trim()) return false;

  if (CJK_SCRIPT_REGEX.test(normalizedTerm)) {
    return normalizedContext.toLowerCase().includes(normalizedTerm.toLowerCase());
  }

  const escapedTerm = escapeRegExp(normalizedTerm);
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapedTerm}(?=$|[^\\p{L}\\p{N}_])`, "iu");
  return pattern.test(normalizedContext);
}

export function isCodexCardMatchedInContext(
  card: {
    name: string;
    aliases?: readonly string[];
    visibleToAI?: boolean;
    alwaysInclude?: boolean;
  },
  activeContextText?: string
): boolean {
  if (card.visibleToAI === false) return false;
  if (card.alwaysInclude === true) return true;

  if (activeContextText === undefined || !activeContextText.trim()) return true;
  if (doesCodexTermMatchContext(card.name, activeContextText)) return true;

  const aliases = card.aliases ?? [];
  for (let i = 0; i < aliases.length; i += 1) {
    if (doesCodexTermMatchContext(aliases[i], activeContextText)) {
      return true;
    }
  }
  return false;
}

export function matchCodexEntitiesInContext(
  storyBible: StoryBible,
  activeContextText?: string
): {
  matchedCharacterIds: Set<string>;
  matchedWorldElementIds: Set<string>;
} {
  const matchedCharacterIds = new Set<string>();
  const matchedWorldElementIds = new Set<string>();

  for (const card of storyBible.characterCards || []) {
    if (isCodexCardMatchedInContext(card, activeContextText)) {
      matchedCharacterIds.add(card.id);
    }
  }

  for (const el of storyBible.worldElements || []) {
    if (isCodexCardMatchedInContext(el, activeContextText)) {
      matchedWorldElementIds.add(el.id);
    }
  }

  return { matchedCharacterIds, matchedWorldElementIds };
}
