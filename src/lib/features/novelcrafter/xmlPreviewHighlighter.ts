// /lib/features/novelcrafter/xmlPreviewHighlighter.ts
// Pure lossless XML preview tokenizer, 2-pass LIFO AST builder, and display trivia normalizer

import type { NovelcrafterContextNode } from "./contextNodes";

export type XmlSemanticGroup = "bible" | "style" | "chapter" | "directive";

export type XmlInlineSegment =
  | { kind: "text"; value: string }
  | {
      kind: "inline-tag";
      raw: string;
      tagName: string;
      group: XmlSemanticGroup;
      contextNode: NovelcrafterContextNode | null;
    };

export type XmlPreviewNode =
  | {
      kind: "element";
      id: string;
      tagName: string;
      openTagRaw: string;
      closeTagRaw: string | null;
      group: XmlSemanticGroup;
      contextNode: NovelcrafterContextNode | null;
      depth: number;
      isInline: boolean;
      inlineText?: string;
      children: readonly XmlPreviewNode[];
    }
  | {
      kind: "text-block";
      id: string;
      depth: number;
      segments: readonly XmlInlineSegment[];
    };

export const CONTEXT_NODE_XML_TAGS: Readonly<Record<NovelcrafterContextNode, string>> = {
  synopsis: "synopsis",
  outline: "outline",
  characters: "characters",
  worldbuilding: "worldbuilding",
  style: "style",
  genre: "genre",
  pov_tense: "narrative_pov_and_tense",
  story_so_far: "story_so_far",
  scenes: "scenes",
  previous_chapter_continuity: "previous_chapter_continuity",
  preceding_prose: "preceding_prose",
};

const XML_TAG_TO_CONTEXT_NODE: ReadonlyMap<string, NovelcrafterContextNode> = new Map(
  (Object.entries(CONTEXT_NODE_XML_TAGS) as Array<[NovelcrafterContextNode, string]>).map(
    ([node, xmlTag]) => [xmlTag, node]
  )
);

const BIBLE_TAGS = new Set<string>([
  "story_bible",
  "braindump",
  "synopsis",
  "outline",
  "characters",
  "character",
  "worldbuilding",
  "world_element",
  "current_synopsis",
  "current_characters",
  "current_worldbuilding",
  "current_outline",
  "current_section",
]);

const STYLE_TAGS = new Set<string>([
  "style",
  "style_guide",
  "genre",
  "narrative_pov_and_tense",
  "style_preferences",
  "master_gem_instructions",
  "task_instructions",
]);

const CHAPTER_TAGS = new Set<string>([
  "chapter_context",
  "chapter_title",
  "story_so_far",
  "scenes",
  "previous_chapter_continuity",
  "preceding_prose",
  "selected_text",
  "chapter_summary",
  "extra_instructions",
  "current_scenes",
  "current_chapter_summary",
]);

type RawXmlToken =
  | { type: "text"; raw: string }
  | { type: "open"; raw: string; tagName: string }
  | { type: "close"; raw: string; tagName: string }
  | { type: "self"; raw: string; tagName: string };

const TAG_START_RE = /[A-Za-z_]/;
const TAG_CHAR_RE = /[A-Za-z0-9_.:-]/;
const WHITESPACE_CHAR_RE = /[ \t\r\n]/;
const WHITESPACE_ONLY_RE = /^[ \t\r\n]*$/;

export function getXmlTagSemanticGroup(tagName: string): XmlSemanticGroup {
  const normalized = tagName.trim().toLowerCase();
  if (BIBLE_TAGS.has(normalized)) return "bible";
  if (STYLE_TAGS.has(normalized)) return "style";
  if (CHAPTER_TAGS.has(normalized)) return "chapter";
  return "directive";
}

export function getContextNodeForXmlTag(tagName: string): NovelcrafterContextNode | null {
  return XML_TAG_TO_CONTEXT_NODE.get(tagName.trim().toLowerCase()) ?? null;
}

export function getContextNodeSemanticGroup(node: NovelcrafterContextNode): XmlSemanticGroup {
  return getXmlTagSemanticGroup(CONTEXT_NODE_XML_TAGS[node]);
}

function tryReadTagToken(xml: string, start: number): { token: RawXmlToken; end: number } | null {
  let cursor = start + 1;
  if (cursor >= xml.length) return null;

  const isClosing = xml[cursor] === "/";
  if (isClosing) cursor += 1;
  if (cursor >= xml.length || !TAG_START_RE.test(xml[cursor])) return null;

  const nameStart = cursor;
  while (cursor < xml.length && TAG_CHAR_RE.test(xml[cursor])) cursor += 1;
  const tagName = xml.slice(nameStart, cursor);

  if (isClosing) {
    while (cursor < xml.length && WHITESPACE_CHAR_RE.test(xml[cursor])) cursor += 1;
    if (xml[cursor] !== ">") return null;
    return {
      token: { type: "close", raw: xml.slice(start, cursor + 1), tagName },
      end: cursor + 1,
    };
  }

  const nextCh = xml[cursor];
  if (nextCh !== ">" && nextCh !== "/" && (!nextCh || !WHITESPACE_CHAR_RE.test(nextCh))) {
    return null;
  }

  let quote: '"' | "'" | null = null;
  while (cursor < xml.length) {
    const ch = xml[cursor];
    if (quote !== null) {
      if (ch === quote) quote = null;
      else if (ch === "\n" || ch === "\r") return null;
      cursor += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "<") {
      return null;
    } else if (ch === ">") {
      const type = xml[cursor - 1] === "/" ? "self" : "open";
      return { token: { type, raw: xml.slice(start, cursor + 1), tagName }, end: cursor + 1 };
    }
    cursor += 1;
  }
  return null;
}

function tokenizeXmlLinear(xml: string): RawXmlToken[] {
  const tokens: RawXmlToken[] = [];
  let pos = 0;
  let textStart = 0;

  while (pos < xml.length) {
    if (xml[pos] !== "<") {
      pos += 1;
      continue;
    }
    const parsed = tryReadTagToken(xml, pos);
    if (!parsed) {
      pos += 1;
      continue;
    }
    if (pos > textStart) {
      tokens.push({ type: "text", raw: xml.slice(textStart, pos) });
    }
    tokens.push(parsed.token);
    pos = parsed.end;
    textStart = pos;
  }

  if (textStart < xml.length) {
    tokens.push({ type: "text", raw: xml.slice(textStart) });
  }
  return tokens;
}

function pairBalancedXmlTokens(tokens: readonly RawXmlToken[]): ReadonlyMap<number, number> {
  const stack: Array<{ tokenIdx: number; normalizedName: string }> = [];
  const matchedOpenToClose = new Map<number, number>();

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.type === "open") {
      stack.push({ tokenIdx: i, normalizedName: tok.tagName.toLowerCase() });
      continue;
    }
    if (tok.type !== "close") continue;
    const target = tok.tagName.toLowerCase();
    for (let k = stack.length - 1; k >= 0; k -= 1) {
      if (stack[k].normalizedName === target) {
        matchedOpenToClose.set(stack[k].tokenIdx, i);
        stack.length = k;
        break;
      }
    }
  }
  return matchedOpenToClose;
}

function appendTextSegment(segments: XmlInlineSegment[], value: string): void {
  if (!value) return;
  const prev = segments[segments.length - 1];
  if (prev && prev.kind === "text") {
    segments[segments.length - 1] = { kind: "text", value: prev.value + value };
  } else {
    segments.push({ kind: "text", value });
  }
}

function extractInlineText(children: readonly XmlPreviewNode[]): string | undefined {
  if (children.length === 0) return "";
  if (children.length !== 1 || children[0].kind !== "text-block") return undefined;
  const segs = children[0].segments;
  if (!segs.every((s) => s.kind === "text")) return undefined;
  const combined = segs.map((s) => s.value).join("");
  return !combined.includes("\n") && !combined.includes("\r") ? combined : undefined;
}

function buildAstRange(
  tokens: readonly RawXmlToken[],
  matched: ReadonlyMap<number, number>,
  startIdx: number,
  endIdx: number,
  depth: number,
  nextId: () => string
): XmlPreviewNode[] {
  const nodes: XmlPreviewNode[] = [];
  let pendingSegments: XmlInlineSegment[] = [];

  const flushPending = (): void => {
    if (pendingSegments.length === 0) return;
    nodes.push({ kind: "text-block", id: nextId(), depth, segments: pendingSegments });
    pendingSegments = [];
  };

  for (let i = startIdx; i < endIdx; i += 1) {
    const tok = tokens[i];
    const closeIdx = tok.type === "open" ? matched.get(i) : undefined;
    if (tok.type === "open" && closeIdx !== undefined) {
      flushPending();
      const children = buildAstRange(tokens, matched, i + 1, closeIdx, depth + 1, nextId);
      const inlineText = extractInlineText(children);
      nodes.push({
        kind: "element",
        id: nextId(),
        tagName: tok.tagName,
        openTagRaw: tok.raw,
        closeTagRaw: tokens[closeIdx].raw,
        group: getXmlTagSemanticGroup(tok.tagName),
        contextNode: getContextNodeForXmlTag(tok.tagName),
        depth,
        isInline: inlineText !== undefined,
        inlineText,
        children,
      });
      i = closeIdx;
    } else if (tok.type === "self") {
      flushPending();
      nodes.push({
        kind: "element",
        id: nextId(),
        tagName: tok.tagName,
        openTagRaw: tok.raw,
        closeTagRaw: null,
        group: getXmlTagSemanticGroup(tok.tagName),
        contextNode: getContextNodeForXmlTag(tok.tagName),
        depth,
        isInline: true,
        inlineText: "",
        children: [],
      });
    } else if (tok.type === "text") {
      appendTextSegment(pendingSegments, tok.raw);
    } else {
      pendingSegments.push({
        kind: "inline-tag",
        raw: tok.raw,
        tagName: tok.tagName,
        group: getXmlTagSemanticGroup(tok.tagName),
        contextNode: getContextNodeForXmlTag(tok.tagName),
      });
    }
  }

  flushPending();
  return nodes;
}

export function parseXmlPreviewNodes(xml: string): readonly XmlPreviewNode[] {
  if (!xml) return [];
  const tokens = tokenizeXmlLinear(xml);
  const matched = pairBalancedXmlTokens(tokens);
  let counter = 0;
  return buildAstRange(tokens, matched, 0, tokens.length, 0, () => {
    counter += 1;
    return `xml-node-${counter}`;
  });
}

export function reconstructXmlText(nodes: readonly XmlPreviewNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text-block") {
        return node.segments.map((s) => (s.kind === "text" ? s.value : s.raw)).join("");
      }
      const inner =
        node.isInline && node.inlineText !== undefined
          ? node.inlineText
          : reconstructXmlText(node.children);
      return `${node.openTagRaw}${inner}${node.closeTagRaw ?? ""}`;
    })
    .join("");
}

export function collectPresentContextNodes(
  nodes: readonly XmlPreviewNode[]
): ReadonlySet<NovelcrafterContextNode> {
  const present = new Set<NovelcrafterContextNode>();
  const visit = (items: readonly XmlPreviewNode[]): void => {
    for (const node of items) {
      if (node.kind === "element") {
        if (node.contextNode !== null) present.add(node.contextNode);
        visit(node.children);
      }
    }
  };
  visit(nodes);
  return present;
}

function isWhitespaceOnlyTextBlock(node: XmlPreviewNode): boolean {
  if (node.kind !== "text-block") return false;
  return node.segments.every((s) => s.kind === "text" && WHITESPACE_ONLY_RE.test(s.value));
}

function trimBoundaryNewlinesFromTextBlock(
  block: Extract<XmlPreviewNode, { kind: "text-block" }>,
  trimLeading: boolean,
  trimTrailing: boolean,
  parentHasElements: boolean
): XmlPreviewNode | null {
  const segs = block.segments.map((s) => ({ ...s }));
  if (trimLeading && segs.length > 0 && segs[0].kind === "text") {
    segs[0] = { kind: "text", value: segs[0].value.replace(/^\r?\n/, "") };
  }
  const lastIdx = segs.length - 1;
  if (trimTrailing && lastIdx >= 0 && segs[lastIdx].kind === "text") {
    segs[lastIdx] = { kind: "text", value: segs[lastIdx].value.replace(/\r?\n[ \t]*$/, "") };
  }
  const nonEmpty = segs.filter((s) => s.kind !== "text" || s.value.length > 0);
  if (nonEmpty.length === 0) return null;
  const candidate: XmlPreviewNode = { ...block, segments: nonEmpty };
  if (parentHasElements && isWhitespaceOnlyTextBlock(candidate)) return null;
  return candidate;
}

export function normalizeBlockDisplayChildren(
  children: readonly XmlPreviewNode[]
): readonly XmlPreviewNode[] {
  const hasElement = children.some((n) => n.kind === "element");
  const filtered = hasElement
    ? children.filter((n) => !isWhitespaceOnlyTextBlock(n))
    : [...children];

  const normalized: XmlPreviewNode[] = [];
  for (let idx = 0; idx < filtered.length; idx += 1) {
    const node = filtered[idx];
    if (node.kind === "element") {
      normalized.push(node);
      continue;
    }
    const trimLeading = idx === 0 || filtered[idx - 1]?.kind === "element";
    const trimTrailing = idx === filtered.length - 1 || filtered[idx + 1]?.kind === "element";
    const trimmed = trimBoundaryNewlinesFromTextBlock(node, trimLeading, trimTrailing, hasElement);
    if (trimmed) normalized.push(trimmed);
  }
  return normalized;
}
