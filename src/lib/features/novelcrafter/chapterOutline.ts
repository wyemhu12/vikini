// src/lib/features/novelcrafter/chapterOutline.ts
import { matchCodexEntitiesInContext } from "./codexMatcher";
import { countChapterWords } from "./draftStorage";
import type { NovelcrafterChapter, StoryBible } from "./types";

/** Progress of a chapter as shown on the outline board (Vikini 3.0 phase 5B/5E). */
export type ChapterOutlineStatus = "idea" | "planned" | "draft";

export interface ChapterOutlineSummary {
  status: ChapterOutlineStatus;
  sceneCount: number;
  wordCount: number;
}

export interface ChapterActGroup {
  key: string;
  actTitle: string | null;
  chapters: Array<{ chapter: NovelcrafterChapter; index: number }>;
  chapterCount: number;
  wordCount: number;
}

export type OutlineContextChipKind =
  | "synopsis"
  | "style"
  | "genre"
  | "character"
  | "world"
  | "previous_chapters";

export interface OutlineContextChip {
  id: string;
  kind: OutlineContextChipKind;
  label?: string;
  count?: number;
}

const BULLET_PREFIX = /^\s*(?:[-*•+]|\d+[.)])\s*/;

/** Splits `scenes` text into clean non-empty beat lines without leading bullet markers. */
export function parseSceneBeats(scenes: string): string[] {
  return (scenes ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean);
}

/** Formats non-empty beat lines back into canonical bullet lines for `chapter.scenes`. */
export function serializeSceneBeats(beats: readonly string[]): string {
  return beats
    .map((b) => b.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean)
    .map((b) => `- ${b}`)
    .join("\n");
}

export function appendSceneBeat(scenes: string, beatText: string): string {
  const clean = beatText.replace(BULLET_PREFIX, "").trim();
  const current = parseSceneBeats(scenes);
  if (!clean) return serializeSceneBeats(current);
  return serializeSceneBeats([...current, clean]);
}

export function updateSceneBeatAt(scenes: string, index: number, nextText: string): string {
  const current = parseSceneBeats(scenes);
  if (index < 0 || index >= current.length) return serializeSceneBeats(current);
  const clean = nextText.replace(BULLET_PREFIX, "").trim();
  const next = [...current];
  if (!clean) {
    next.splice(index, 1);
  } else {
    next[index] = clean;
  }
  return serializeSceneBeats(next);
}

export function removeSceneBeatAt(scenes: string, index: number): string {
  const current = parseSceneBeats(scenes);
  if (index < 0 || index >= current.length) return serializeSceneBeats(current);
  return serializeSceneBeats(current.filter((_, i) => i !== index));
}

/** Number of non-empty beat lines; a line holding only a bullet marker does not count. */
export function countSceneBeats(scenes: string): number {
  return parseSceneBeats(scenes).length;
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

/** Groups consecutive chapters sharing the same trimmed `actTitle` while keeping global index. */
export function groupChaptersByAct(chapters: readonly NovelcrafterChapter[]): ChapterActGroup[] {
  const groups: ChapterActGroup[] = [];
  chapters.forEach((chapter, index) => {
    const normalizedAct = chapter.actTitle?.trim() || null;
    const words = countChapterWords(chapter.content ?? "");
    const last = groups[groups.length - 1];
    if (last && last.actTitle === normalizedAct) {
      last.chapters.push({ chapter, index });
      last.chapterCount += 1;
      last.wordCount += words;
    } else {
      groups.push({
        key: `${groups.length}-${normalizedAct ?? "unassigned"}`,
        actTitle: normalizedAct,
        chapters: [{ chapter, index }],
        chapterCount: 1,
        wordCount: words,
      });
    }
  });
  return groups;
}

/** Counts named act groups (`actTitle !== null`) across the story; 0 when no chapter sets an act. */
export function countStoryActs(chapters: readonly NovelcrafterChapter[]): number {
  return groupChaptersByAct(chapters).filter((g) => g.actTitle !== null).length;
}

/** Computes context chips that AI will read when drafting the given chapter (NovelOutline §AI). */
export function resolveChapterOutlineContextChips(
  chapter: NovelcrafterChapter,
  chapterIndex: number,
  storyBible: StoryBible
): OutlineContextChip[] {
  const chips: OutlineContextChip[] = [];

  if (storyBible.synopsis.trim() && storyBible.synopsisVisibleToAI !== false) {
    chips.push({ id: "synopsis", kind: "synopsis" });
  }
  if (storyBible.style.trim() && storyBible.styleVisibleToAI !== false) {
    chips.push({ id: "style", kind: "style" });
  }
  if (storyBible.genre.trim() && storyBible.genreVisibleToAI !== false) {
    chips.push({ id: "genre", kind: "genre" });
  }

  const contextText = [chapter.title, chapter.summary ?? "", chapter.scenes, chapter.content]
    .filter(Boolean)
    .join("\n");
  const hasExplicitChapterText = Boolean(
    (chapter.summary ?? "").trim() || chapter.scenes.trim() || chapter.content.trim()
  );

  if (storyBible.charactersVisibleToAI !== false) {
    const matched = hasExplicitChapterText
      ? matchCodexEntitiesInContext(storyBible, contextText).matchedCharacterIds
      : new Set(
          (storyBible.characterCards ?? [])
            .filter((c) => c.visibleToAI !== false && c.alwaysInclude === true)
            .map((c) => c.id)
        );
    for (const card of (storyBible.characterCards ?? []).slice(0, 15)) {
      if (card.visibleToAI !== false && matched.has(card.id)) {
        chips.push({ id: `char-${card.id}`, kind: "character", label: card.name });
        if (chips.filter((c) => c.kind === "character").length >= 6) break;
      }
    }
  }

  if (storyBible.worldbuildingVisibleToAI !== false) {
    const matchedWorlds = hasExplicitChapterText
      ? matchCodexEntitiesInContext(storyBible, contextText).matchedWorldElementIds
      : new Set(
          (storyBible.worldElements ?? [])
            .filter((w) => w.visibleToAI !== false && w.alwaysInclude === true)
            .map((w) => w.id)
        );
    let addedWorldCard = false;
    for (const el of (storyBible.worldElements ?? []).slice(0, 15)) {
      if (el.visibleToAI !== false && matchedWorlds.has(el.id)) {
        chips.push({ id: `world-${el.id}`, kind: "world", label: el.name });
        addedWorldCard = true;
        if (chips.filter((c) => c.kind === "world").length >= 4) break;
      }
    }
    if (!addedWorldCard && storyBible.worldbuilding.trim()) {
      chips.push({ id: "worldbuilding", kind: "world" });
    }
  }

  if (chapterIndex > 0) {
    chips.push({ id: "previous_chapters", kind: "previous_chapters", count: chapterIndex });
  }

  return chips;
}
