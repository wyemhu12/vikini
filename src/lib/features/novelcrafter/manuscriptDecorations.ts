// /lib/features/novelcrafter/manuscriptDecorations.ts
// Atomic decoration slicer for Feedback underlines, Codex entity highlights, and Persisted Selection

import { findQuoteRangeInText } from "./feedbackParser";
import type { ManuscriptBlockKind, ManuscriptInlineKind, ManuscriptLine } from "./manuscriptMarkup";
import type { NovelcrafterFeedbackItem } from "./types";

const SAFE_DECORATION_ID_REGEX = /^[A-Za-z0-9_-]{1,100}$/;

export function isSafeDecorationId(id: string): boolean {
  return typeof id === "string" && SAFE_DECORATION_ID_REGEX.test(id);
}

export type ManuscriptDecoration =
  | { kind: "feedback"; id: string; start: number; end: number; active: boolean }
  | {
      kind: "codex";
      entityId: string;
      entityKind: "character" | "world";
      start: number;
      end: number;
    }
  | { kind: "selection"; start: number; end: number };

export interface RenderSegment {
  text: string;
  start: number;
  end: number;
  classes: string[];
  feedbackId?: string;
  codexId?: string;
  codexKind?: "character" | "world";
}

export interface RenderLine {
  index: number;
  block: ManuscriptBlockKind;
  segments: RenderSegment[];
  signature: string;
  hasTrailingNewline: boolean;
}

const INLINE_KIND_CLASS: Record<ManuscriptInlineKind, string | null> = {
  text: null,
  marker: "nc-marker",
  bold: "nc-bold",
  italic: "nc-italic",
  strike: "nc-strike",
};

export function buildFeedbackDecorations(
  content: string,
  items: readonly NovelcrafterFeedbackItem[],
  activeId: string | null
): ManuscriptDecoration[] {
  if (!content || !items || items.length === 0) return [];
  const decorations: ManuscriptDecoration[] = [];

  for (const item of items) {
    if (item.status !== "open" || !item.quote || !isSafeDecorationId(item.id)) {
      continue;
    }
    const range = findQuoteRangeInText(content, item.quote);
    if (!range || range.end <= range.start) continue;
    decorations.push({
      kind: "feedback",
      id: item.id,
      start: range.start,
      end: range.end,
      active: item.id === activeId,
    });
  }

  return decorations;
}

function collectLineBoundaries(
  line: ManuscriptLine,
  overlapping: readonly ManuscriptDecoration[]
): number[] {
  const points = new Set<number>([line.start, line.end]);
  for (const seg of line.segments) {
    points.add(Math.max(line.start, Math.min(line.end, seg.start)));
    points.add(Math.max(line.start, Math.min(line.end, seg.end)));
  }
  for (const dec of overlapping) {
    points.add(Math.max(line.start, Math.min(line.end, dec.start)));
    points.add(Math.max(line.start, Math.min(line.end, dec.end)));
  }
  return Array.from(points).sort((a, b) => a - b);
}

function buildAtomicSegment(
  content: string,
  line: ManuscriptLine,
  overlapping: readonly ManuscriptDecoration[],
  segStart: number,
  segEnd: number
): RenderSegment {
  const classes: string[] = [];
  const inlineSeg = line.segments.find((s) => s.start <= segStart && s.end >= segEnd);
  if (inlineSeg) {
    const inlineClass = INLINE_KIND_CLASS[inlineSeg.kind];
    if (inlineClass) classes.push(inlineClass);
  }

  let feedbackId: string | undefined;
  let codexId: string | undefined;
  let codexKind: "character" | "world" | undefined;
  let hasSelection = false;
  let isFeedbackActive = false;

  for (const dec of overlapping) {
    if (dec.start > segStart || dec.end < segEnd) continue;
    if (dec.kind === "selection") {
      hasSelection = true;
    } else if (dec.kind === "feedback" && isSafeDecorationId(dec.id)) {
      if (!feedbackId || dec.active) {
        feedbackId = dec.id;
        isFeedbackActive = dec.active;
      }
    } else if (dec.kind === "codex" && isSafeDecorationId(dec.entityId)) {
      if (!codexId) {
        codexId = dec.entityId;
        codexKind = dec.entityKind;
      }
    }
  }

  if (codexId) classes.push("nc-codex");
  if (feedbackId) {
    classes.push("nc-feedback");
    if (isFeedbackActive) classes.push("nc-feedback-active");
  }
  if (hasSelection) classes.push("nc-selection");

  const segment: RenderSegment = {
    text: content.slice(segStart, segEnd),
    start: segStart,
    end: segEnd,
    classes,
  };
  if (feedbackId) segment.feedbackId = feedbackId;
  if (codexId) segment.codexId = codexId;
  if (codexKind) segment.codexKind = codexKind;
  return segment;
}

export function computeRenderLineSignature(
  block: ManuscriptBlockKind,
  segments: readonly RenderSegment[],
  hasTrailingNewline: boolean
): string {
  const segPart = segments
    .map(
      (s) =>
        `${s.classes.join(".")}:${s.feedbackId ?? ""}:${s.codexId ?? ""}:${s.codexKind ?? ""}:${s.text}`
    )
    .join("\u0001");
  return `${block}|${hasTrailingNewline ? "1" : "0"}|${segPart}`;
}

export function buildRenderLines(
  content: string,
  lines: readonly ManuscriptLine[],
  decorations: readonly ManuscriptDecoration[]
): RenderLine[] {
  const totalLines = lines.length;
  return lines.map((line, idx) => {
    const hasTrailingNewline = idx < totalLines - 1;
    if (line.end <= line.start) {
      const signature = computeRenderLineSignature(line.block, [], hasTrailingNewline);
      return {
        index: line.index,
        block: line.block,
        segments: [],
        signature,
        hasTrailingNewline,
      };
    }

    const overlapping = decorations.filter((d) => d.end > line.start && d.start < line.end);
    const boundaries = collectLineBoundaries(line, overlapping);
    const segments: RenderSegment[] = [];

    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const segStart = boundaries[i];
      const segEnd = boundaries[i + 1];
      if (segEnd <= segStart) continue;
      segments.push(buildAtomicSegment(content, line, overlapping, segStart, segEnd));
    }

    const signature = computeRenderLineSignature(line.block, segments, hasTrailingNewline);
    return {
      index: line.index,
      block: line.block,
      segments,
      signature,
      hasTrailingNewline,
    };
  });
}
