// src/lib/features/novelcrafter/chapterOutline.ts
import { countChapterWords } from "./draftStorage";
import type { NovelcrafterChapter } from "./types";

/** Progress of a chapter as shown on the outline board (Vikini 3.0 phase 5B). */
export type ChapterOutlineStatus = "idea" | "planned" | "draft";

export interface ChapterOutlineSummary {
  status: ChapterOutlineStatus;
  sceneCount: number;
  wordCount: number;
}

const BULLET_PREFIX = /^\s*(?:[-*•+]|\d+[.)])\s*/;

/** Number of non-empty beat lines; a line holding only a bullet marker does not count. */
export function countSceneBeats(scenes: string): number {
  return scenes
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean).length;
}

/**
 * Derives the outline card data for a chapter: prose → "draft"; no prose but a summary or
 * beats → "planned"; nothing yet → "idea". Whitespace never counts as content.
 */
export function summarizeChapterForOutline(
  chapter: Pick<NovelcrafterChapter, "content" | "scenes" | "summary">
): ChapterOutlineSummary {
  const wordCount = countChapterWords(chapter.content ?? "");
  const sceneCount = countSceneBeats(chapter.scenes ?? "");
  const hasSummary = Boolean(chapter.summary?.trim());
  const status: ChapterOutlineStatus =
    wordCount > 0 ? "draft" : sceneCount > 0 || hasSummary ? "planned" : "idea";
  return { status, sceneCount, wordCount };
}

/** Chapter and word totals for the whole story. */
export function summarizeStoryOutline(chapters: readonly Pick<NovelcrafterChapter, "content">[]): {
  chapterCount: number;
  wordCount: number;
} {
  return {
    chapterCount: chapters.length,
    wordCount: chapters.reduce((sum, ch) => sum + countChapterWords(ch.content ?? ""), 0),
  };
}
