// /app/features/novelcrafter/utils/manuscriptDomOffsets.test.ts
import { describe, expect, it } from "vitest";
import { buildRenderLines } from "@/lib/features/novelcrafter/manuscriptDecorations";
import { tokenizeManuscriptLines } from "@/lib/features/novelcrafter/manuscriptMarkup";
import {
  buildLineElement,
  getOffsetFromDomPosition,
  readSelectionOffsets,
  resolveDomPosition,
  serializeManuscriptRoot,
  setSelectionOffsets,
} from "./manuscriptDomOffsets";

function renderRootFromContent(content: string): HTMLDivElement {
  const root = document.createElement("div");
  const lines = buildRenderLines(content, tokenizeManuscriptLines(content), []);
  for (const line of lines) {
    root.appendChild(buildLineElement(document, line));
  }
  return root;
}

describe("manuscriptDomOffsets (TC-DOM)", () => {
  it("DM-1: builds line elements for 'ab\\n\\ncd', renders placeholder <br> on empty line, and serializes back to 'ab\\n\\ncd'", () => {
    const content = "ab\n\ncd";
    const root = renderRootFromContent(content);
    expect(serializeManuscriptRoot(root)).toBe("ab\n\ncd");

    const emptyLine = root.children[1] as HTMLElement;
    expect(emptyLine.querySelector("br[data-nc-placeholder]")).not.toBeNull();
    expect(emptyLine.textContent).toBe("\n");
  });

  it("DM-2: round-trips resolveDomPosition and getOffsetFromDomPosition across every character offset", () => {
    const content = "ab\n\ncd";
    const root = renderRootFromContent(content);

    const pos4 = resolveDomPosition(root, 4);
    expect(pos4.node.nodeValue).toBe("cd");
    expect(pos4.offset).toBe(0);

    for (let offset = 0; offset <= content.length; offset += 1) {
      const pos = resolveDomPosition(root, offset);
      const recovered = getOffsetFromDomPosition(root, pos.node, pos.offset);
      expect(recovered).toBe(offset);
    }
  });

  it("DM-3: sets and reads selection offsets accurately inside root", () => {
    const content = "Hello **world**!\nSecond line.";
    const root = renderRootFromContent(content);
    document.body.appendChild(root);

    setSelectionOffsets(root, 1, 5);
    expect(readSelectionOffsets(root)).toEqual({ start: 1, end: 5 });

    document.body.removeChild(root);
  });

  it("DM-4: returns null when selection is outside the editor root", () => {
    const root = renderRootFromContent("Inside editor");
    const outside = document.createElement("p");
    outside.textContent = "Outside paragraph";
    document.body.appendChild(root);
    document.body.appendChild(outside);

    const sel = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(outside);
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(readSelectionOffsets(root)).toBeNull();

    document.body.removeChild(root);
    document.body.removeChild(outside);
  });

  it("DM-5 (Negative/XSS): renders raw HTML/script payloads as inert textContent without creating DOM elements", () => {
    const payload = "<img src=x onerror=alert(1)><script>evil()</script>";
    const root = renderRootFromContent(payload);

    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toBe(payload);
  });

  it("DM-6: clamps out-of-range offsets without throwing", () => {
    const root = renderRootFromContent("short");
    const neg = resolveDomPosition(root, -50);
    expect(getOffsetFromDomPosition(root, neg.node, neg.offset)).toBe(0);

    const high = resolveDomPosition(root, 999);
    expect(getOffsetFromDomPosition(root, high.node, high.offset)).toBe(5);
  });
});
