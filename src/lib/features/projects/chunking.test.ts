import { describe, it, expect } from "vitest";
import { chunkText, chunkCode, getChunkingStrategy, chunkContent } from "./chunking";

describe("chunking (TC-W1-09)", () => {
  describe("chunkText", () => {
    it("returns empty array for empty or whitespace-only text", () => {
      expect(chunkText("")).toEqual([]);
      expect(chunkText("   \n\n  ")).toEqual([]);
    });

    it("preserves short trailing chunk (< minChunkSize) with zero data loss", () => {
      const para1 = "A".repeat(450);
      const para2 = "B".repeat(450);
      const shortTail = "CRITICAL TAIL 20CHAR";
      const doc = `${para1}\n\n${para2}\n\n${shortTail}`;

      const chunks = chunkText(doc, { maxChunkSize: 500, overlap: 50, minChunkSize: 50 });
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      const allContent = chunks.map((c) => c.content).join("\n");
      expect(allContent).toContain(shortTail);
      for (const c of chunks) {
        expect(c.content.length).toBeLessThanOrEqual(550);
      }
    });

    it("hard-splits a single 2500-char paragraph with no breaks into bounded overlapping chunks", () => {
      const giantPara = Array.from(
        { length: 250 },
        (_, i) => `word${String(i).padStart(4, "0")} `
      ).join("");
      const chunks = chunkText(giantPara, { maxChunkSize: 800, overlap: 100, minChunkSize: 50 });

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const c of chunks) {
        expect(c.content.length).toBeLessThanOrEqual(800);
      }
      // First and last tokens are preserved
      expect(chunks[0].content).toContain("word0000");
      expect(chunks[chunks.length - 1].content).toContain("word0249");
    });

    it("tracks accurate line_start and line_end across multiple blank lines (\\n\\n\\n+)", () => {
      const p1 = "Line 1 first paragraph ".repeat(30).trim(); // Line 1
      const p2 = "Line 5 second paragraph ".repeat(30).trim(); // After \n\n\n\n -> Line 5
      const doc = `${p1}\n\n\n\n${p2}`;

      const chunks = chunkText(doc, { maxChunkSize: 750, overlap: 0, minChunkSize: 50 });
      expect(chunks).toHaveLength(2);
      expect(chunks[0].metadata.line_start).toBe(1);
      expect(chunks[0].metadata.line_end).toBe(1);
      expect(chunks[1].metadata.line_start).toBe(5);
      expect(chunks[1].metadata.line_end).toBe(5);
    });
  });

  describe("chunkCode", () => {
    it("splits a 2500-char function with NO breakpoints into bounded chunks and preserves trailing lines", () => {
      const bodyLines = Array.from(
        { length: 60 },
        (_, i) => `  result += computeStep(${i}, "payload-segment-data");`
      );
      const code = ["export function bigFn() {", ...bodyLines, "  return result;", "}"].join("\n");

      const chunks = chunkCode(code, { maxChunkSize: 800, overlap: 100, minChunkSize: 50 });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const c of chunks) {
        expect(c.content.length).toBeLessThanOrEqual(900);
      }
      const joined = chunks.map((c) => c.content).join("\n");
      expect(joined).toContain("return result;");
      expect(chunks[0].metadata.line_start).toBe(1);
      expect(chunks[chunks.length - 1].metadata.line_end).toBe(63);
    });

    it("hard-splits an oversized single minified code line", () => {
      const minified = "x".repeat(2500);
      const chunks = chunkCode(minified, { maxChunkSize: 800, overlap: 100, minChunkSize: 50 });
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const c of chunks) {
        expect(c.content.length).toBeLessThanOrEqual(800);
      }
    });
  });

  describe("getChunkingStrategy & chunkContent", () => {
    it("returns 'text' for files without extension (Makefile, Dockerfile, .env, trailing dot)", () => {
      expect(getChunkingStrategy("Makefile")).toBe("text");
      expect(getChunkingStrategy("Dockerfile")).toBe("text");
      expect(getChunkingStrategy(".ts")).toBe("text");
      expect(getChunkingStrategy("notes.")).toBe("text");
      expect(getChunkingStrategy("readme.md")).toBe("text");
    });

    it("returns 'code' for supported source code extensions", () => {
      expect(getChunkingStrategy("app.ts")).toBe("code");
      expect(getChunkingStrategy("script.PY")).toBe("code");
      expect(getChunkingStrategy("config.json")).toBe("code");
    });

    it("chunkContent dispatches cleanly by filename", () => {
      const res = chunkContent("export function hello() {\n  return 1;\n}", "hello.ts");
      expect(res).toHaveLength(1);
      expect(res[0].content).toContain("hello");
    });
  });
});
