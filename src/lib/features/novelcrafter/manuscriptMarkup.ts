// /lib/features/novelcrafter/manuscriptMarkup.ts
// Zero-dependency line & inline Markdown tokenizer and formatter preserving exact 1:1 character offsets

export type ManuscriptFormat = "bold" | "italic" | "strike" | "h1" | "h2" | "ul" | "ol" | "hr";

export type ManuscriptBlockKind =
  | "paragraph"
  | "h1"
  | "h2"
  | "sceneBreak"
  | "bullet"
  | "ordered"
  | "blank";

export type ManuscriptInlineKind = "text" | "marker" | "bold" | "italic" | "strike";

export interface ManuscriptInlineSegment {
  kind: ManuscriptInlineKind;
  start: number;
  end: number;
}

export interface ManuscriptLine {
  index: number;
  start: number;
  end: number;
  block: ManuscriptBlockKind;
  segments: ManuscriptInlineSegment[];
}

function classifyBlock(lineText: string): { block: ManuscriptBlockKind; prefixLen: number } {
  if (lineText.length === 0) {
    return { block: "blank", prefixLen: 0 };
  }
  const trimmed = lineText.trim();
  if (trimmed.length >= 3 && (/^(?:\*\s*){3,}$/.test(trimmed) || /^-{3,}$/.test(trimmed))) {
    return { block: "sceneBreak", prefixLen: lineText.length };
  }
  if (lineText.startsWith("# ")) {
    return { block: "h1", prefixLen: 2 };
  }
  if (lineText.startsWith("## ")) {
    return { block: "h2", prefixLen: 3 };
  }
  if (lineText.startsWith("- ") || lineText.startsWith("* ")) {
    return { block: "bullet", prefixLen: 2 };
  }
  const orderedMatch = /^(\d+\.\s)/.exec(lineText);
  if (orderedMatch) {
    return { block: "ordered", prefixLen: orderedMatch[1].length };
  }
  return { block: "paragraph", prefixLen: 0 };
}

function pushSegment(
  segments: ManuscriptInlineSegment[],
  kind: ManuscriptInlineKind,
  start: number,
  end: number
): void {
  if (end <= start) return;
  const last = segments[segments.length - 1];
  if (last && last.kind === "text" && kind === "text" && last.end === start) {
    last.end = end;
    return;
  }
  segments.push({ kind, start, end });
}

function matchDelimitedSpan(
  lineText: string,
  pos: number
): { markerLen: number; closePos: number; kind: "bold" | "italic" | "strike" } | null {
  if (lineText.startsWith("**", pos)) {
    const close = lineText.indexOf("**", pos + 2);
    if (close > pos + 2) {
      return { markerLen: 2, closePos: close, kind: "bold" };
    }
    return null;
  }
  if (lineText.startsWith("~~", pos)) {
    const close = lineText.indexOf("~~", pos + 2);
    if (close > pos + 2) {
      return { markerLen: 2, closePos: close, kind: "strike" };
    }
    return null;
  }
  const ch = lineText[pos];
  if (ch === "*" || ch === "_") {
    const close = lineText.indexOf(ch, pos + 1);
    if (close > pos + 1) {
      return { markerLen: 1, closePos: close, kind: "italic" };
    }
  }
  return null;
}

function tokenizeInline(
  lineText: string,
  lineStart: number,
  prefixLen: number,
  block: ManuscriptBlockKind
): ManuscriptInlineSegment[] {
  if (lineText.length === 0) return [];
  if (block === "sceneBreak") {
    return [{ kind: "marker", start: lineStart, end: lineStart + lineText.length }];
  }

  const segments: ManuscriptInlineSegment[] = [];
  if (prefixLen > 0) {
    pushSegment(segments, "marker", lineStart, lineStart + prefixLen);
  }

  let i = prefixLen;
  const n = lineText.length;
  while (i < n) {
    const matched = matchDelimitedSpan(lineText, i);
    if (matched) {
      const openStart = lineStart + i;
      const innerStart = openStart + matched.markerLen;
      const innerEnd = lineStart + matched.closePos;
      const closeEnd = innerEnd + matched.markerLen;
      pushSegment(segments, "marker", openStart, innerStart);
      pushSegment(segments, matched.kind, innerStart, innerEnd);
      pushSegment(segments, "marker", innerEnd, closeEnd);
      i = matched.closePos + matched.markerLen;
    } else {
      pushSegment(segments, "text", lineStart + i, lineStart + i + 1);
      i += 1;
    }
  }

  return segments;
}

export function tokenizeManuscriptLines(content: string): ManuscriptLine[] {
  if (content.length === 0) {
    return [{ index: 0, start: 0, end: 0, block: "blank", segments: [] }];
  }

  const rawLines = content.split("\n");
  const result: ManuscriptLine[] = [];
  let offset = 0;

  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const lineText = rawLines[idx];
    const start = offset;
    const end = start + lineText.length;
    const { block, prefixLen } = classifyBlock(lineText);
    const segments = tokenizeInline(lineText, start, prefixLen, block);
    result.push({ index: idx, start, end, block, segments });
    offset = end + 1;
  }

  return result;
}

function applyInlineWrapToggle(
  content: string,
  s: number,
  e: number,
  marker: string
): { content: string; selectionStart: number; selectionEnd: number } {
  const mLen = marker.length;
  const selected = content.slice(s, e);

  if (selected.length > mLen * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(mLen, selected.length - mLen);
    const next = `${content.slice(0, s)}${inner}${content.slice(e)}`;
    return { content: next, selectionStart: s, selectionEnd: s + inner.length };
  }

  if (s >= mLen && content.slice(s - mLen, s) === marker && content.slice(e, e + mLen) === marker) {
    const next = `${content.slice(0, s - mLen)}${selected}${content.slice(e + mLen)}`;
    return { content: next, selectionStart: s - mLen, selectionEnd: e - mLen };
  }

  const inner = selected || "text";
  const wrapped = `${marker}${inner}${marker}`;
  const next = `${content.slice(0, s)}${wrapped}${content.slice(e)}`;
  return {
    content: next,
    selectionStart: s + mLen,
    selectionEnd: s + mLen + inner.length,
  };
}

export function applyManuscriptFormat(
  content: string,
  start: number,
  end: number,
  fmt: ManuscriptFormat
): { content: string; selectionStart: number; selectionEnd: number } {
  const len = content.length;
  const cStart = Math.max(0, Math.min(len, Number.isFinite(start) ? Math.floor(start) : len));
  const cEnd = Math.max(0, Math.min(len, Number.isFinite(end) ? Math.floor(end) : len));
  const s = Math.min(cStart, cEnd);
  const e = Math.max(cStart, cEnd);

  if (fmt === "bold") return applyInlineWrapToggle(content, s, e, "**");
  if (fmt === "italic") return applyInlineWrapToggle(content, s, e, "*");
  if (fmt === "strike") return applyInlineWrapToggle(content, s, e, "~~");

  if (fmt === "hr") {
    const insert = "\n\n***\n\n";
    const next = `${content.slice(0, s)}${insert}${content.slice(e)}`;
    const cursor = s + insert.length;
    return { content: next, selectionStart: cursor, selectionEnd: cursor };
  }

  const selected = content.slice(s, e) || "text";
  const prefixMap: Record<"h1" | "h2" | "ul" | "ol", string> = {
    h1: "# ",
    h2: "## ",
    ul: "- ",
    ol: "1. ",
  };
  const prefix = prefixMap[fmt];
  const needsLeadNewline = s > 0 && content[s - 1] !== "\n";
  const needsTrailNewline = (fmt === "h1" || fmt === "h2") && e < len && content[e] !== "\n";
  const lead = needsLeadNewline ? "\n" : "";
  const trail = needsTrailNewline ? "\n" : "";
  const replacement = `${lead}${prefix}${selected}${trail}`;
  const next = `${content.slice(0, s)}${replacement}${content.slice(e)}`;
  const selStart = s + lead.length + prefix.length;
  return {
    content: next,
    selectionStart: selStart,
    selectionEnd: selStart + selected.length,
  };
}
