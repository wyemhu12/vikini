// /lib/features/novelcrafter/contextNodes.test.ts
import { describe, expect, it } from "vitest";
import {
  isNovelcrafterContextNode,
  MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS,
  normalizeContextNodes,
  NOVELCRAFTER_CONTEXT_NODES,
} from "./contextNodes";

describe("contextNodes (CN-01..CN-02)", () => {
  it("CN-01: exports all 11 canonical context nodes and 4000-char override cap", () => {
    expect(NOVELCRAFTER_CONTEXT_NODES).toEqual([
      "synopsis",
      "outline",
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
      "story_so_far",
      "scenes",
      "previous_chapter_continuity",
      "preceding_prose",
    ]);
    expect(MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS).toBe(4_000);
    expect(isNovelcrafterContextNode("synopsis")).toBe(true);
    expect(isNovelcrafterContextNode("bogus")).toBe(false);
    expect(isNovelcrafterContextNode(null)).toBe(false);
  });

  it("CN-02: normalizeContextNodes filters invalid entries and deduplicates in canonical order", () => {
    expect(normalizeContextNodes("not-an-array")).toBeUndefined();
    expect(
      normalizeContextNodes(["preceding_prose", "bogus", "synopsis", "preceding_prose", 123])
    ).toEqual(["synopsis", "preceding_prose"]);
  });
});
