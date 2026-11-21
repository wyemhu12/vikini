// /lib/features/novelcrafter/codexMatcher.ts
// Unicode word-boundary Codex alias & context auto-matching for Novelcrafter Studio (Phase 3.1)

import { MAX_CODEX_ALIASES, MAX_CODEX_ALIAS_CHARS, type StoryBible } from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CJK_SCRIPT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

export interface CodexMentionRange {
  entityId: string;
  entityKind: "character" | "world";
  start: number;
  end: number;
}

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

interface NormalizedContext {
  nfc: string;
  lower: string;
}

function normalizeContextText(contextText?: string): NormalizedContext | null {
  if (contextText === undefined) return null;
  const nfc = contextText.normalize("NFC");
  if (!nfc.trim()) return null;
  return { nfc, lower: nfc.toLowerCase() };
}

function doesCodexTermMatchNormalizedContext(term: string, context: NormalizedContext): boolean {
  const normalizedTerm = term.trim().normalize("NFC");
  if (normalizedTerm.length < 2) return false;

  if (CJK_SCRIPT_REGEX.test(normalizedTerm)) {
    return context.lower.includes(normalizedTerm.toLowerCase());
  }

  const escapedTerm = escapeRegExp(normalizedTerm);
  const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapedTerm}(?=$|[^\\p{L}\\p{N}_])`, "iu");
  return pattern.test(context.nfc);
}

export function doesCodexTermMatchContext(term: string, contextText: string): boolean {
  const normalizedContext = normalizeContextText(contextText);
  if (!normalizedContext) return false;
  return doesCodexTermMatchNormalizedContext(term, normalizedContext);
}

function isCodexCardMatchedInNormalizedContext(
  card: {
    name: string;
    aliases?: readonly string[];
    visibleToAI?: boolean;
    alwaysInclude?: boolean;
  },
  normalizedContext: NormalizedContext | null
): boolean {
  if (card.visibleToAI === false) return false;
  if (card.alwaysInclude === true) return true;
  if (normalizedContext === null) return true;

  if (doesCodexTermMatchNormalizedContext(card.name, normalizedContext)) return true;

  const aliases = card.aliases ?? [];
  for (let i = 0; i < aliases.length; i += 1) {
    if (doesCodexTermMatchNormalizedContext(aliases[i], normalizedContext)) {
      return true;
    }
  }
  return false;
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

  const normalizedContext = normalizeContextText(activeContextText);
  return isCodexCardMatchedInNormalizedContext(card, normalizedContext);
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
  const normalizedContext = normalizeContextText(activeContextText);

  for (const card of storyBible.characterCards || []) {
    if (isCodexCardMatchedInNormalizedContext(card, normalizedContext)) {
      matchedCharacterIds.add(card.id);
    }
  }

  for (const el of storyBible.worldElements || []) {
    if (isCodexCardMatchedInNormalizedContext(el, normalizedContext)) {
      matchedWorldElementIds.add(el.id);
    }
  }

  return { matchedCharacterIds, matchedWorldElementIds };
}

interface CodexSearchTerm {
  entityId: string;
  entityKind: "character" | "world";
  termLower: string;
  length: number;
  isCjk: boolean;
  order: number;
}

function collectCodexSearchTerms(storyBible: StoryBible): CodexSearchTerm[] {
  const terms: CodexSearchTerm[] = [];
  let order = 0;

  const addTerm = (raw: string, entityId: string, entityKind: "character" | "world") => {
    const trimmed = raw.trim();
    if (trimmed.length < 2 || !entityId) return;
    const termLower = trimmed.toLowerCase();
    terms.push({
      entityId,
      entityKind,
      termLower,
      length: termLower.length,
      isCjk: CJK_SCRIPT_REGEX.test(trimmed),
      order: order++,
    });
  };

  for (const card of storyBible.characterCards || []) {
    addTerm(card.name, card.id, "character");
    for (const alias of card.aliases ?? []) {
      addTerm(alias, card.id, "character");
    }
  }

  for (const el of storyBible.worldElements || []) {
    addTerm(el.name, el.id, "world");
    for (const alias of el.aliases ?? []) {
      addTerm(alias, el.id, "world");
    }
  }

  return terms;
}

export function findCodexMentionRanges(
  storyBible: StoryBible,
  text: string,
  maxRanges = 2000
): CodexMentionRange[] {
  if (!text || maxRanges <= 0) return [];
  const terms = collectCodexSearchTerms(storyBible);
  if (terms.length === 0) return [];

  const textLower = text.toLowerCase();
  const candidates: Array<CodexMentionRange & { order: number }> = [];

  for (const item of terms) {
    let fromIdx = 0;
    while (fromIdx <= textLower.length - item.length) {
      const found = textLower.indexOf(item.termLower, fromIdx);
      if (found === -1) break;
      const end = found + item.length;
      const validBoundary =
        item.isCjk ||
        ((found === 0 || !WORD_CHAR_REGEX.test(textLower[found - 1] ?? "")) &&
          (end >= textLower.length || !WORD_CHAR_REGEX.test(textLower[end] ?? "")));

      if (validBoundary) {
        candidates.push({
          entityId: item.entityId,
          entityKind: item.entityKind,
          start: found,
          end,
          order: item.order,
        });
      }
      fromIdx = found + 1;
    }
  }

  if (candidates.length === 0) return [];

  candidates.sort(
    (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start || a.order - b.order
  );

  const occupied = new Uint8Array(textLower.length);
  const selected: CodexMentionRange[] = [];
  for (const cand of candidates) {
    let overlaps = false;
    for (let i = cand.start; i < cand.end; i += 1) {
      if (occupied[i] === 1) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      occupied.fill(1, cand.start, cand.end);
      selected.push({
        entityId: cand.entityId,
        entityKind: cand.entityKind,
        start: cand.start,
        end: cand.end,
      });
    }
  }

  selected.sort((a, b) => a.start - b.start);
  return selected.slice(0, maxRanges);
}
