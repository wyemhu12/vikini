// src/lib/features/novelcrafter/chapterOutline.test.ts
import { describe, it, expect } from "vitest";
import { StoryBibleSchema, type NovelcrafterChapter } from "./types";
import {
  appendSceneBeat,
  countSceneBeats,
  countStoryActs,
  groupChaptersByAct,
  parseSceneBeats,
  removeSceneBeatAt,
  resolveChapterOutlineContextChips,
  serializeSceneBeats,
  summarizeChapterForOutline,
  summarizeStoryOutline,
  updateSceneBeatAt,
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

function makeCh(
  id: string,
  title: string,
  extra: Partial<NovelcrafterChapter> = {}
): NovelcrafterChapter {
  return {
    id,
    title,
    scenes: "",
    extraInstructions: "",
    content: "",
    feedbackItems: [],
    updatedAt: 0,
    ...extra,
  };
}

describe("5E TC-02: act grouping, scene beat list helpers, and AI context chips", () => {
  it("groups consecutive chapters by actTitle while preserving global chapter index", () => {
    const chapters = [
      makeCh("c1", "Bến cũ", { actTitle: "Hồi 1 · Rời bến", content: "một hai" }),
      makeCh("c2", "Lá thư", { actTitle: " Hồi 1 · Rời bến ", content: "ba bốn năm" }),
      makeCh("c3", "Nước lên", { actTitle: "Hồi 2 · Mùa lũ", content: "sáu" }),
      makeCh("c4", "Ngoại truyện"),
    ];
    expect(countStoryActs(chapters)).toBe(2);
    expect(countStoryActs([makeCh("x", "Không hồi")])).toBe(0);

    const groups = groupChaptersByAct(chapters);
    expect(groups).toHaveLength(3);
    expect(groups[0].actTitle).toBe("Hồi 1 · Rời bến");
    expect(groups[0].chapterCount).toBe(2);
    expect(groups[0].wordCount).toBe(5);
    expect(groups[0].chapters.map((x) => x.index)).toEqual([0, 1]);
    expect(groups[1].actTitle).toBe("Hồi 2 · Mùa lũ");
    expect(groups[1].chapters[0].index).toBe(2);
    expect(groups[2].actTitle).toBeNull();
    expect(groups[2].chapters[0].index).toBe(3);
  });

  it("parses, appends, updates, and removes scene beats cleanly", () => {
    const initial = "- Lam xuống bến\n2. Ông lái đò nhìn cô";
    expect(parseSceneBeats(initial)).toEqual(["Lam xuống bến", "Ông lái đò nhìn cô"]);

    const added = appendSceneBeat(initial, "Mưa lớn ghé bãi bồi");
    expect(parseSceneBeats(added)).toEqual([
      "Lam xuống bến",
      "Ông lái đò nhìn cô",
      "Mưa lớn ghé bãi bồi",
    ]);

    const updated = updateSceneBeatAt(added, 1, "Ông Tư nhận ra Lam");
    expect(parseSceneBeats(updated)).toEqual([
      "Lam xuống bến",
      "Ông Tư nhận ra Lam",
      "Mưa lớn ghé bãi bồi",
    ]);

    const removed = removeSceneBeatAt(updated, 0);
    expect(removed).toBe(serializeSceneBeats(["Ông Tư nhận ra Lam", "Mưa lớn ghé bãi bồi"]));
  });

  it("resolves AI context chips and omits sections or cards hidden from AI", () => {
    const ch = makeCh("c4", "Làng Đông", {
      summary: "Lam về tới Làng Đông tìm lại ngôi nhà cũ.",
    });
    const visibleBible = StoryBibleSchema.parse({
      synopsis: "Hành trình trở về mùa lũ.",
      synopsisVisibleToAI: true,
      style: "Trữ tình, tiết chế.",
      styleVisibleToAI: true,
      charactersVisibleToAI: true,
      characterCards: [
        { id: "char-lam", name: "Lam", visibleToAI: true },
        { id: "char-hidden", name: "Làng", visibleToAI: false },
        { id: "char-other", name: "Bình", visibleToAI: true },
      ],
      worldbuildingVisibleToAI: true,
      worldElements: [{ id: "w-lang", name: "Làng Đông", visibleToAI: true }],
    });

    const chips = resolveChapterOutlineContextChips(ch, 3, visibleBible);
    expect(chips.map((c) => c.kind)).toContain("synopsis");
    expect(chips.map((c) => c.kind)).toContain("style");
    expect(chips.find((c) => c.kind === "character" && c.label === "Lam")).toBeDefined();
    expect(chips.find((c) => c.label === "Bình")).toBeUndefined();
    expect(chips.find((c) => c.label === "Làng")).toBeUndefined();
    expect(chips.find((c) => c.kind === "world" && c.label === "Làng Đông")).toBeDefined();
    expect(chips.find((c) => c.kind === "previous_chapters")?.count).toBe(3);

    // Negative case: hidden synopsis & characters must NOT appear in AI context chips
    const hiddenBible = StoryBibleSchema.parse({
      ...visibleBible,
      synopsisVisibleToAI: false,
      charactersVisibleToAI: false,
    });
    const hiddenChips = resolveChapterOutlineContextChips(ch, 0, hiddenBible);
    expect(hiddenChips.find((c) => c.kind === "synopsis")).toBeUndefined();
    expect(hiddenChips.find((c) => c.kind === "character")).toBeUndefined();
    expect(hiddenChips.find((c) => c.kind === "previous_chapters")).toBeUndefined();
  });
});
