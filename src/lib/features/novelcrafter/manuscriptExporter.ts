// /lib/features/novelcrafter/manuscriptExporter.ts
// Pure manuscript export formatter (.md & .txt) and client download helper for Novelcrafter Studio (Phase 3.5)

import { countChapterWords } from "./draftStorage";
import { serializeStoryBibleWithStructuredCards } from "./storyBibleSerializer";
import type { NovelcrafterStoryState } from "./types";

export interface FormatManuscriptExportParams {
  storyTitle: string;
  storyState: NovelcrafterStoryState;
  format: "markdown" | "txt";
  includeStoryBible?: boolean;
  includeChapterSummaries?: boolean;
}

export interface ManuscriptExportResult {
  filename: string;
  mimeType: string;
  content: string;
  totalWords: number;
}

export function sanitizeExportFilename(title: string, extension: "md" | "txt"): string {
  const normalized = (title || "").normalize("NFC").trim();
  const cleaned = normalized
    .replace(/[<>:"/\\|?*\p{Cc}]+/gu, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  const baseName = cleaned || "novelcrafter-manuscript";
  return `${baseName}.${extension}`;
}

export function stripMarkdownForPlainText(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, "----------------------------------------")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/___(.+?)___/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatManuscriptExport(
  params: FormatManuscriptExportParams
): ManuscriptExportResult {
  const {
    storyTitle,
    storyState,
    format,
    includeStoryBible = false,
    includeChapterSummaries = false,
  } = params;
  const cleanTitle = storyTitle.trim() || "Untitled Story";
  const bible = storyState.storyBible;
  const totalWords = storyState.chapters.reduce(
    (sum, ch) => sum + countChapterWords(ch.content),
    0
  );

  if (format === "markdown") {
    const sections: string[] = [];
    const headerLines: string[] = [`# ${cleanTitle}`];
    const metaParts: string[] = [];
    if (bible.genre.trim()) metaParts.push(`**Genre:** ${bible.genre.trim()}`);
    if (bible.pov) metaParts.push(`**POV:** ${bible.pov}`);
    if (bible.tense) metaParts.push(`**Tense:** ${bible.tense}`);
    if (metaParts.length > 0) {
      headerLines.push(metaParts.join(" | "));
    }
    sections.push(headerLines.join("\n\n"));

    if (includeStoryBible) {
      const serialized = serializeStoryBibleWithStructuredCards(bible);
      const bibleSubsections: string[] = ["## Story Bible"];
      if (bible.synopsis.trim()) {
        bibleSubsections.push(`### Synopsis\n\n${bible.synopsis.trim()}`);
      }
      if (bible.style.trim()) {
        bibleSubsections.push(`### Style\n\n${bible.style.trim()}`);
      }
      if (serialized.outlineText.trim()) {
        bibleSubsections.push(`### Outline\n\n${serialized.outlineText.trim()}`);
      }
      if (serialized.charactersText.trim()) {
        bibleSubsections.push(`### Characters\n\n${serialized.charactersText.trim()}`);
      }
      if (serialized.worldbuildingText.trim()) {
        bibleSubsections.push(`### Worldbuilding\n\n${serialized.worldbuildingText.trim()}`);
      }
      if (bibleSubsections.length > 1) {
        sections.push(bibleSubsections.join("\n\n"));
      }
    }

    const chapterBlocks: string[] = [];
    for (let i = 0; i < storyState.chapters.length; i += 1) {
      const ch = storyState.chapters[i];
      const chTitle = ch.title.trim() || `Chapter ${i + 1}`;
      const chParts: string[] = [`## ${chTitle}`];
      if (includeChapterSummaries && ch.summary?.trim()) {
        const summaryFormatted = ch.summary.trim().split(/\r?\n/).join("\n> ");
        chParts.push(`> **Summary:** ${summaryFormatted}`);
      }
      if (ch.content.trim()) {
        chParts.push(ch.content.trim());
      }
      chapterBlocks.push(chParts.join("\n\n"));
    }

    if (chapterBlocks.length > 0) {
      sections.push(chapterBlocks.join("\n\n---\n\n"));
    }

    return {
      filename: sanitizeExportFilename(cleanTitle, "md"),
      mimeType: "text/markdown;charset=utf-8",
      content: `${sections.join("\n\n---\n\n")}\n`,
      totalWords,
    };
  }

  // format === "txt"
  const divider = "========================================";
  const txtSections: string[] = [];
  const headerLines: string[] = [cleanTitle.toUpperCase(), divider];
  const metaParts: string[] = [];
  if (bible.genre.trim()) metaParts.push(`Genre: ${bible.genre.trim()}`);
  if (bible.pov) metaParts.push(`POV: ${bible.pov}`);
  if (bible.tense) metaParts.push(`Tense: ${bible.tense}`);
  if (metaParts.length > 0) {
    headerLines.push(metaParts.join(" | "));
  }
  txtSections.push(headerLines.join("\n"));

  if (includeStoryBible) {
    const serialized = serializeStoryBibleWithStructuredCards(bible);
    const bibleParts: string[] = ["STORY BIBLE", "----------------------------------------"];
    if (bible.synopsis.trim()) {
      bibleParts.push(`Synopsis:\n${stripMarkdownForPlainText(bible.synopsis)}`);
    }
    if (bible.style.trim()) {
      bibleParts.push(`Style:\n${stripMarkdownForPlainText(bible.style)}`);
    }
    if (serialized.outlineText.trim()) {
      bibleParts.push(`Outline:\n${stripMarkdownForPlainText(serialized.outlineText)}`);
    }
    if (serialized.charactersText.trim()) {
      bibleParts.push(`Characters:\n${stripMarkdownForPlainText(serialized.charactersText)}`);
    }
    if (serialized.worldbuildingText.trim()) {
      bibleParts.push(`Worldbuilding:\n${stripMarkdownForPlainText(serialized.worldbuildingText)}`);
    }
    if (bibleParts.length > 2) {
      txtSections.push(bibleParts.join("\n\n"));
    }
  }

  for (let i = 0; i < storyState.chapters.length; i += 1) {
    const ch = storyState.chapters[i];
    const chTitle = ch.title.trim() || `Chapter ${i + 1}`;
    const chParts: string[] = [chTitle, "----------------------------------------"];
    if (includeChapterSummaries && ch.summary?.trim()) {
      chParts.push(`[Summary]: ${stripMarkdownForPlainText(ch.summary)}`);
    }
    if (ch.content.trim()) {
      chParts.push(stripMarkdownForPlainText(ch.content));
    }
    txtSections.push(chParts.join("\n\n"));
  }

  return {
    filename: sanitizeExportFilename(cleanTitle, "txt"),
    mimeType: "text/plain;charset=utf-8",
    content: `${txtSections.join(`\n\n${divider}\n\n`)}\n`,
    totalWords,
  };
}

export function triggerManuscriptDownload(exportResult: {
  filename: string;
  mimeType: string;
  content: string;
}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportResult.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
