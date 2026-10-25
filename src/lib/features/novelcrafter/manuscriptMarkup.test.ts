// /lib/features/novelcrafter/manuscriptMarkup.test.ts
import { describe, expect, it } from "vitest";
import { applyManuscriptFormat, tokenizeManuscriptLines } from "./manuscriptMarkup";
import { MAX_CHAPTER_PROSE_CHARS } from "./types";

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("manuscriptMarkup (TC-MARKUP)", () => {
  it("MK-1: tokenizes h1, paragraph with bold/italic/strike, blank, sceneBreak, and h2 with exact absolute offsets", () => {
    const content = "# Title\nBody **bold** and *it* ~~x~~\n\n***\n## Sub";
    const lines = tokenizeManuscriptLines(content);

    expect(lines).toHaveLength(5);
    expect(lines.map((l) => l.block)).toEqual(["h1", "paragraph", "blank", "sceneBreak", "h2"]);

    const line1 = lines[1];
    expect(content.slice(line1.start, line1.end)).toBe("Body **bold** and *it* ~~x~~");
    expect(
      line1.segments.map((s) => ({
        kind: s.kind,
        text: content.slice(s.start, s.end),
      }))
    ).toEqual([
      { kind: "text", text: "Body " },
      { kind: "marker", text: "**" },
      { kind: "bold", text: "bold" },
      { kind: "marker", text: "**" },
      { kind: "text", text: " and " },
      { kind: "marker", text: "*" },
      { kind: "italic", text: "it" },
      { kind: "marker", text: "*" },
      { kind: "text", text: " " },
      { kind: "marker", text: "~~" },
      { kind: "strike", text: "x" },
      { kind: "marker", text: "~~" },
    ]);
  });

  it("MK-2 (Invariant I1): 500 seeded random strings (seed 42) preserve 1:1 contiguous character offsets", () => {
    const rand = createMulberry32(42);
    const alphabet = [
      "#",
      "*",
      "~",
      "_",
      "-",
      "\n",
      " ",
      "a",
      "b",
      "1",
      ".",
      "á",
      "đ",
      "ệ",
      "ư",
      "李",
      "明",
      "✨",
      "🐉",
    ];

    for (let iter = 0; iter < 500; iter += 1) {
      const len = Math.floor(rand() * 140);
      let str = "";
      for (let i = 0; i < len; i += 1) {
        const ch = alphabet[Math.floor(rand() * alphabet.length)];
        str += ch;
      }

      const lines = tokenizeManuscriptLines(str);
      const reconstructedLines: string[] = [];

      let expectedLineStart = 0;
      for (const line of lines) {
        expect(line.start).toBe(expectedLineStart);
        let segCursor = line.start;
        let lineReconstructed = "";
        for (const seg of line.segments) {
          expect(seg.start).toBe(segCursor);
          expect(seg.end).toBeGreaterThan(seg.start);
          lineReconstructed += str.slice(seg.start, seg.end);
          segCursor = seg.end;
        }
        expect(segCursor).toBe(line.end);
        reconstructedLines.push(lineReconstructed);
        expectedLineStart = line.end + 1;
      }

      expect(reconstructedLines.join("\n")).toBe(str);
    }
  });

  it("MK-3: treats unclosed delimiters as plain text without throwing", () => {
    for (const sample of ["**unclosed", "*", "~~"]) {
      const lines = tokenizeManuscriptLines(sample);
      expect(lines).toHaveLength(1);
      expect(lines[0].block).toBe("paragraph");
      expect(lines[0].segments).toEqual([{ kind: "text", start: 0, end: sample.length }]);
    }
  });

  it("MK-4: returns a single blank line descriptor for empty string", () => {
    expect(tokenizeManuscriptLines("")).toEqual([
      { index: 0, start: 0, end: 0, block: "blank", segments: [] },
    ]);
  });

  it("MK-5: tokenizes 150,000 characters (MAX_CHAPTER_PROSE_CHARS) within budget (<150ms CI threshold)", () => {
    const unit = "# Chương 1\nĐêm **lạnh** trên *đỉnh núi* ~~cũ~~.\n\n***\n";
    const repeatCount = Math.ceil(MAX_CHAPTER_PROSE_CHARS / unit.length);
    const large = unit.repeat(repeatCount).slice(0, MAX_CHAPTER_PROSE_CHARS);
    expect(large.length).toBe(MAX_CHAPTER_PROSE_CHARS);

    const t0 = performance.now();
    const lines = tokenizeManuscriptLines(large);
    const elapsedMs = performance.now() - t0;

    expect(lines.length).toBeGreaterThan(1000);
    expect(elapsedMs).toBeLessThan(150);
  });

  it("MK-6: applyManuscriptFormat wraps selection in bold and unwraps when toggled again", () => {
    const first = applyManuscriptFormat("abc", 0, 3, "bold");
    expect(first).toEqual({
      content: "**abc**",
      selectionStart: 2,
      selectionEnd: 5,
    });

    const second = applyManuscriptFormat(
      first.content,
      first.selectionStart,
      first.selectionEnd,
      "bold"
    );
    expect(second).toEqual({
      content: "abc",
      selectionStart: 0,
      selectionEnd: 3,
    });
  });

  it("MK-7: clamps out-of-bounds offsets safely without throwing when applying h1", () => {
    const res = applyManuscriptFormat("abc", 5, 9, "h1");
    expect(res.content).toContain("# ");
    expect(res.selectionStart).toBeGreaterThanOrEqual(0);
    expect(res.selectionEnd).toBeLessThanOrEqual(res.content.length);
  });
});
