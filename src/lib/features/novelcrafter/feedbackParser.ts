// /lib/features/novelcrafter/feedbackParser.ts
// Structured parser, regex-safe quote locator, LCS word-level diff, and 1-click suggestion applier for Sudowrite-style Feedback

import { MAX_FEEDBACK_ITEMS_PER_CHAPTER, type NovelcrafterFeedbackItem } from "./types";

export interface WordDiffSegment {
  type: "equal" | "delete" | "insert";
  text: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractXmlTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = regex.exec(block);
  return match ? match[1].trim() : "";
}

/**
 * Parse <feedback_item> blocks emitted by the Feedback tool.
 * When `isStreaming === true`, only closed `</feedback_item>` blocks are parsed so incomplete trailing tags don't flicker.
 */
export function parseFeedbackItems(
  rawText: string,
  options?: { isStreaming?: boolean; nowMs?: number }
): NovelcrafterFeedbackItem[] {
  const nowMs = options?.nowMs ?? Date.now();
  const isStreaming = Boolean(options?.isStreaming);
  const items: NovelcrafterFeedbackItem[] = [];

  const blockRegex = /<feedback_item>([\s\S]*?)<\/feedback_item>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = blockRegex.exec(rawText)) !== null) {
    const inner = match[1];
    const category = (extractXmlTag(inner, "category") || "EDITORIAL").toUpperCase().slice(0, 80);
    const quote = extractXmlTag(inner, "quote").slice(0, 10_000);
    const comment = extractXmlTag(inner, "comment").slice(0, 10_000);
    const suggestion = extractXmlTag(inner, "suggestion").slice(0, 15_000);

    if (comment) {
      idx += 1;
      items.push({
        id: `fb-${nowMs}-${idx}`,
        category,
        quote,
        comment,
        suggestion,
        status: "open",
        createdAt: nowMs + idx,
      });
    }
    if (items.length >= MAX_FEEDBACK_ITEMS_PER_CHAPTER) {
      break;
    }
  }

  if (items.length === 0 && !isStreaming) {
    const trimmed = rawText.trim();
    if (trimmed.length > 0 && !trimmed.includes("<feedback_item>")) {
      items.push({
        id: `fb-${nowMs}-1`,
        category: "EDITORIAL",
        quote: "",
        comment: trimmed.slice(0, 10_000),
        suggestion: "",
        status: "open",
        createdAt: nowMs,
      });
    }
  }

  return items;
}

/**
 * Locate the start and end character offsets of `quote` inside `chapterContent`.
 * Uses exact indexOf first, then falls back to a regex-escaped whitespace-normalized match.
 */
export function findQuoteRangeInText(
  chapterContent: string,
  quote: string
): { start: number; end: number } | null {
  const trimmedQuote = quote.trim();
  if (!trimmedQuote || !chapterContent) {
    return null;
  }

  const exactIndex = chapterContent.indexOf(trimmedQuote);
  if (exactIndex !== -1) {
    return {
      start: exactIndex,
      end: exactIndex + trimmedQuote.length,
    };
  }

  const tokens = trimmedQuote.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const pattern = tokens.map(escapeRegExp).join("\\s+");
  try {
    const regex = new RegExp(pattern);
    const match = regex.exec(chapterContent);
    if (!match || match.index === undefined) {
      return null;
    }
    return {
      start: match.index,
      end: match.index + match[0].length,
    };
  } catch {
    return null;
  }
}

/**
 * Replace the first occurrence of `quote` inside `chapterContent` with `suggestion`.
 */
export function applyFeedbackSuggestionToText(
  chapterContent: string,
  quote: string,
  suggestion: string
): { updatedContent: string; applied: boolean } {
  const cleanSuggestion = suggestion.trim();
  if (!cleanSuggestion) {
    return { updatedContent: chapterContent, applied: false };
  }

  const range = findQuoteRangeInText(chapterContent, quote);
  if (!range) {
    return { updatedContent: chapterContent, applied: false };
  }

  const updatedContent =
    chapterContent.slice(0, range.start) + cleanSuggestion + chapterContent.slice(range.end);

  return {
    updatedContent,
    applied: true,
  };
}

function tokenizeWordsAndSpaces(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

/**
 * Compute a word-level diff between `quote` and `suggestion` for rendering
 * strikethrough deletions and accent-highlighted insertions in the Feedback card.
 */
export function computeWordDiff(quote: string, suggestion: string): WordDiffSegment[] {
  const cleanQuote = quote.trim();
  const cleanSuggestion = suggestion.trim();

  if (!cleanQuote && !cleanSuggestion) return [];
  if (!cleanQuote) return [{ type: "insert", text: cleanSuggestion }];
  if (!cleanSuggestion) return [{ type: "delete", text: cleanQuote }];

  const a = tokenizeWordsAndSpaces(cleanQuote);
  const b = tokenizeWordsAndSpaces(cleanSuggestion);

  // Guard against quadratic blowup on very long excerpts
  if (a.length * b.length > 90_000) {
    return [
      { type: "delete", text: cleanQuote },
      { type: "equal", text: " " },
      { type: "insert", text: cleanSuggestion },
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const rawSegments: WordDiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rawSegments.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawSegments.push({ type: "delete", text: a[i] });
      i++;
    } else {
      rawSegments.push({ type: "insert", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    rawSegments.push({ type: "delete", text: a[i++] });
  }
  while (j < n) {
    rawSegments.push({ type: "insert", text: b[j++] });
  }

  const merged: WordDiffSegment[] = [];
  for (const seg of rawSegments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
