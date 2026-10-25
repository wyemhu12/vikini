// /app/features/novelcrafter/utils/manuscriptDomOffsets.ts
// DOM <-> Plaintext string character offset mapping and safe line rendering (Zero innerHTML)

import {
  computeRenderLineSignature,
  isSafeDecorationId,
  type RenderLine,
  type RenderSegment,
} from "@/lib/features/novelcrafter/manuscriptDecorations";
import type { ManuscriptBlockKind } from "@/lib/features/novelcrafter/manuscriptMarkup";

export interface DomCaretPosition {
  node: Node;
  offset: number;
}

export interface ManuscriptSelectionRange {
  start: number;
  end: number;
}

function collectTextNodes(root: Node): Text[] {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function isTrailingNewlineTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return Boolean(
    parent &&
    parent.hasAttribute("data-line") &&
    node.nodeValue === "\n" &&
    parent.lastChild === node
  );
}

export function serializeManuscriptRoot(root: HTMLElement): string {
  const raw = root.textContent ?? "";
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function getOffsetFromDomPosition(root: HTMLElement, node: Node, offset: number): number {
  if (!root.contains(node)) return 0;

  if (node.nodeType === Node.TEXT_NODE) {
    const textNodes = collectTextNodes(root);
    let total = 0;
    for (const tn of textNodes) {
      const len = tn.nodeValue?.length ?? 0;
      if (tn === node) {
        return total + Math.max(0, Math.min(offset, len));
      }
      total += len;
    }
    return total;
  }

  const clampedIndex = Math.max(0, Math.min(offset, node.childNodes.length));
  if (clampedIndex < node.childNodes.length) {
    const refChild = node.childNodes[clampedIndex];
    const textNodes = collectTextNodes(root);
    let total = 0;
    for (const tn of textNodes) {
      if (tn === refChild || refChild.contains(tn)) {
        return total;
      }
      const pos = refChild.compareDocumentPosition(tn);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        return total;
      }
      total += tn.nodeValue?.length ?? 0;
    }
    return total;
  }

  const textNodes = collectTextNodes(root);
  let total = 0;
  for (const tn of textNodes) {
    if (node === root || node.contains(tn)) {
      total += tn.nodeValue?.length ?? 0;
      continue;
    }
    const pos = node.compareDocumentPosition(tn);
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
      total += tn.nodeValue?.length ?? 0;
    }
  }
  return total;
}

export function resolveDomPosition(root: HTMLElement, targetOffset: number): DomCaretPosition {
  const textNodes = collectTextNodes(root);
  if (textNodes.length === 0) {
    const firstLine = root.querySelector("[data-line]");
    return { node: firstLine ?? root, offset: 0 };
  }

  const totalLen = textNodes.reduce((sum, tn) => sum + (tn.nodeValue?.length ?? 0), 0);
  const clamped = Math.max(0, Math.min(targetOffset, totalLen));

  let accumulated = 0;
  for (let i = 0; i < textNodes.length; i += 1) {
    const tn = textNodes[i];
    const len = tn.nodeValue?.length ?? 0;
    const nodeStart = accumulated;
    const nodeEnd = accumulated + len;
    const isTrailingNl = isTrailingNewlineTextNode(tn);

    if (isTrailingNl) {
      if (clamped === nodeStart) {
        return { node: tn, offset: 0 };
      }
      if (clamped === nodeEnd && i === textNodes.length - 1) {
        const lastLine = root.lastElementChild;
        if (lastLine && lastLine !== tn.parentElement) {
          return { node: lastLine, offset: 0 };
        }
        return { node: tn, offset: len };
      }
    } else if (clamped >= nodeStart && clamped <= nodeEnd) {
      return { node: tn, offset: clamped - nodeStart };
    }

    accumulated = nodeEnd;
  }

  const last = textNodes[textNodes.length - 1];
  return { node: last, offset: last.nodeValue?.length ?? 0 };
}

export function readSelectionOffsets(root: HTMLElement): ManuscriptSelectionRange | null {
  const doc = root.ownerDocument ?? document;
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return null;
  }
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const startOffset = getOffsetFromDomPosition(root, range.startContainer, range.startOffset);
  const endOffset = getOffsetFromDomPosition(root, range.endContainer, range.endOffset);
  return {
    start: Math.min(startOffset, endOffset),
    end: Math.max(startOffset, endOffset),
  };
}

export function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
  const doc = root.ownerDocument ?? document;
  const sel = doc.getSelection();
  if (!sel) return;

  const startPos = resolveDomPosition(root, Math.min(start, end));
  const endPos = resolveDomPosition(root, Math.max(start, end));
  const range = doc.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function buildLineElement(doc: Document, line: RenderLine): HTMLDivElement {
  const lineEl = doc.createElement("div");
  lineEl.dataset.line = String(line.index);
  lineEl.dataset.block = line.block;
  lineEl.dataset.sig = line.signature;
  lineEl.className = `nc-line nc-${line.block}`;

  if (line.segments.length === 0) {
    const br = doc.createElement("br");
    br.dataset.ncPlaceholder = "true";
    lineEl.appendChild(br);
  } else {
    for (const seg of line.segments) {
      const tagName = seg.feedbackId && isSafeDecorationId(seg.feedbackId) ? "mark" : "span";
      const segEl = doc.createElement(tagName);
      if (seg.classes.length > 0) {
        segEl.className = seg.classes.join(" ");
      }
      if (seg.feedbackId && isSafeDecorationId(seg.feedbackId)) {
        segEl.dataset.feedbackId = seg.feedbackId;
      }
      if (seg.codexId && isSafeDecorationId(seg.codexId)) {
        segEl.dataset.codexId = seg.codexId;
      }
      if (seg.codexKind) {
        segEl.dataset.codexKind = seg.codexKind;
      }
      segEl.textContent = seg.text;
      lineEl.appendChild(segEl);
    }
  }

  if (line.hasTrailingNewline) {
    lineEl.appendChild(doc.createTextNode("\n"));
  }
  return lineEl;
}

export function deriveDomLineSignature(lineEl: HTMLElement): string {
  const block = (lineEl.dataset.block as ManuscriptBlockKind | undefined) ?? "paragraph";
  const children = Array.from(lineEl.childNodes);
  let hasTrailingNewline = false;
  let endIdx = children.length;

  if (endIdx > 0) {
    const last = children[endIdx - 1];
    if (last.nodeType === Node.TEXT_NODE && last.nodeValue === "\n") {
      hasTrailingNewline = true;
      endIdx -= 1;
    }
  }

  if (endIdx === 1 && children[0] instanceof HTMLElement && children[0].tagName === "BR") {
    return computeRenderLineSignature(block, [], hasTrailingNewline);
  }

  const segments: RenderSegment[] = [];
  let offset = 0;
  for (let i = 0; i < endIdx; i += 1) {
    const child = children[i];
    if (!(child instanceof HTMLElement)) return "";
    if (child.tagName !== "SPAN" && child.tagName !== "MARK") return "";
    if (child.childElementCount > 0) return "";
    const text = child.textContent ?? "";
    if (!text) return "";
    const seg: RenderSegment = {
      text,
      start: offset,
      end: offset + text.length,
      classes: Array.from(child.classList),
    };
    if (child.dataset.feedbackId) seg.feedbackId = child.dataset.feedbackId;
    if (child.dataset.codexId) seg.codexId = child.dataset.codexId;
    if (child.dataset.codexKind === "character" || child.dataset.codexKind === "world") {
      seg.codexKind = child.dataset.codexKind;
    }
    segments.push(seg);
    offset += text.length;
  }

  return computeRenderLineSignature(block, segments, hasTrailingNewline);
}
