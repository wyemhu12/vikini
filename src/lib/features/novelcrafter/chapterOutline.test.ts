// src/lib/features/novelcrafter/chapterOutline.test.ts
import { describe, it, expect } from "vitest";
import {
  countSceneBeats,
  summarizeChapterForOutline,
  summarizeStoryOutline,
} from "./chapterOutline";

describe("summarizeChapterForOutline (TC-01)", () => {
  it("derives idea / planned / draft from the chapter content", () => {
    expect(summarizeChapterForOutline({ content: "", scenes: "", summary: undefined }).status).toBe(
      "idea"
    );
    expect(summarizeChapterForOutline({ content: "", scenes: "", summary: "Mở đầu" }).status).toBe(
      "planned"
    );
    expect(summarizeChapterForOutline({ content: "", scenes: "- Lam lên đò" }).status).toBe(
      "planned"
    );
    expect(summarizeChapterForOutline({ content: "Chuyến đò cuối.", scenes: "" }).status).toBe(
      "draft"
    );
  });

  it("does not count whitespace as content", () => {
    const result = summarizeChapterForOutline({
      content: "  \n\t ",
      scenes: " \n ",
      summary: "  ",
    });
    expect(result).toEqual({ status: "idea", sceneCount: 0, wordCount: 0 });
  });
});

describe("countSceneBeats / summarizeStoryOutline (TC-02)", () => {
  it("counts non-empty beat lines and ignores bare bullets", () => {
    expect(countSceneBeats("- A\n\n* B\n1. C\n   \n-\n2.")).toBe(3);
    expect(countSceneBeats("")).toBe(0);
  });

  it("totals chapters and words across the story", () => {
    expect(
      summarizeStoryOutline([{ content: "một hai ba" }, { content: "bốn năm sáu bảy" }])
    ).toEqual({ chapterCount: 2, wordCount: 7 });
    expect(summarizeStoryOutline([])).toEqual({ chapterCount: 0, wordCount: 0 });
  });
});
