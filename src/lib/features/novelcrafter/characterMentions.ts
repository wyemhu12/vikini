// /lib/features/novelcrafter/characterMentions.ts
// Counts character & alias occurrences across chapter prose and scene beats (Vikini 3.0 Phase 5C)

import { doesCodexTermMatchContext } from "./codexMatcher";
import type { NovelcrafterChapter, StoryBibleCharacterCard } from "./types";

const CJK_SCRIPT_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

export interface CharacterChapterMention {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  proseCount: number;
  inOutline: boolean;
}

interface NormalizedTerm {
  raw: string;
  lower: string;
  length: number;
  isCjk: boolean;
}

function collectCharacterTerms(
  card: Pick<StoryBibleCharacterCard, "name" | "aliases">
): NormalizedTerm[] {
  const candidates = [card.name, ...(card.aliases ?? [])];
  const terms: NormalizedTerm[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const normalized = (item || "").trim().normalize("NFC");
    if (normalized.length < 2) continue;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    terms.push({
      raw: normalized,
      lower,
      length: normalized.length,
      isCjk: CJK_SCRIPT_REGEX.test(normalized),
    });
  }

  return terms;
}

function countNonOverlappingMentions(terms: readonly NormalizedTerm[], text: string): number {
  if (!text || terms.length === 0) return 0;
  const normalizedText = text.normalize("NFC");
  if (!normalizedText.trim()) return 0;
  const textLower = normalizedText.toLowerCase();

  const spans: Array<{ start: number; end: number }> = [];
  for (const term of terms) {
    let fromIdx = 0;
    while (fromIdx <= textLower.length - term.length) {
      const found = textLower.indexOf(term.lower, fromIdx);
      if (found === -1) break;
      const end = found + term.length;
      const validBoundary =
        term.isCjk ||
        ((found === 0 || !WORD_CHAR_REGEX.test(normalizedText[found - 1])) &&
          (end === normalizedText.length || !WORD_CHAR_REGEX.test(normalizedText[end])));
      if (validBoundary) {
        spans.push({ start: found, end });
      }
      fromIdx = found + 1;
    }
  }

  if (spans.length === 0) return 0;
  spans.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);

  const selected: Array<{ start: number; end: number }> = [];
  for (const cand of spans) {
    const overlaps = selected.some((s) => cand.start < s.end && s.start < cand.end);
    if (!overlaps) selected.push(cand);
  }
  return selected.length;
}

export function computeCharacterMentions(
  card: Pick<StoryBibleCharacterCard, "name" | "aliases">,
  chapters: readonly Pick<NovelcrafterChapter, "id" | "title" | "content" | "scenes" | "summary">[]
): { items: CharacterChapterMention[]; totalProseCount: number } {
  const terms = collectCharacterTerms(card);
  if (terms.length === 0 || chapters.length === 0) {
    return { items: [], totalProseCount: 0 };
  }

  const items: CharacterChapterMention[] = [];
  let totalProseCount = 0;

  for (let i = 0; i < chapters.length; i += 1) {
    const ch = chapters[i];
    const proseCount = countNonOverlappingMentions(terms, ch.content || "");
    const outlineSource = [ch.scenes || "", ch.summary || ""].filter(Boolean).join("\n");
    const inOutline = outlineSource
      ? terms.some((t) => doesCodexTermMatchContext(t.raw, outlineSource))
      : false;

    if (proseCount > 0 || inOutline) {
      totalProseCount += proseCount;
      items.push({
        chapterId: ch.id,
        chapterNumber: i + 1,
        chapterTitle: ch.title,
        proseCount,
        inOutline,
      });
    }
  }

  return { items, totalProseCount };
}
