// /lib/features/novelcrafter/characterMentions.test.ts
import { describe, expect, it } from "vitest";
import { computeCharacterMentions } from "./characterMentions";

describe("computeCharacterMentions (5C TC-01)", () => {
  it("counts non-overlapping name and alias mentions in prose and detects outline-only chapters", () => {
    const result = computeCharacterMentions(
      {
        name: "Ông Tư",
        aliases: ["ông lái đò", "Ông Tư Đò"],
      },
      [
        {
          id: "ch-1",
          title: "Chương 1: Mùa nước nổi",
          content: "Ông Tư chèo đò qua sông. Chiều xuống, ông lái đò ghé bến cũ.",
          scenes: "",
          summary: "",
        },
        {
          id: "ch-2",
          title: "Chương 2: Lá thư",
          content: "Mưa rơi trắng xóa cả con đê dài.",
          scenes: "- Ông Tư giấu phong thư dưới ván thuyền",
          summary: "",
        },
        {
          id: "ch-3",
          title: "Chương 3: Khoảng lặng",
          content: "Không một bóng thuyền trên bến.",
          scenes: "",
          summary: "",
        },
      ]
    );

    expect(result.totalProseCount).toBe(2);
    expect(result.items).toEqual([
      {
        chapterId: "ch-1",
        chapterNumber: 1,
        chapterTitle: "Chương 1: Mùa nước nổi",
        proseCount: 2,
        inOutline: false,
      },
      {
        chapterId: "ch-2",
        chapterNumber: 2,
        chapterTitle: "Chương 2: Lá thư",
        proseCount: 0,
        inOutline: true,
      },
    ]);
  });

  it("deduplicates overlapping alias/name spans and returns empty for < 2 char names (Negative)", () => {
    const overlap = computeCharacterMentions(
      {
        name: "Ông Tư",
        aliases: ["Ông Tư Đò"],
      },
      [
        {
          id: "ch-1",
          title: "Ch. 1",
          content: "Ông Tư Đò đứng lặng nhìn dòng nước.",
          scenes: "",
        },
      ]
    );
    expect(overlap.totalProseCount).toBe(1);
    expect(overlap.items[0]?.proseCount).toBe(1);

    expect(
      computeCharacterMentions({ name: "A", aliases: ["x"] }, [
        { id: "ch-1", title: "Ch. 1", content: "A x A", scenes: "A" },
      ])
    ).toEqual({ items: [], totalProseCount: 0 });

    expect(
      computeCharacterMentions({ name: "   " }, [
        { id: "ch-1", title: "Ch. 1", content: "Nội dung", scenes: "" },
      ])
    ).toEqual({ items: [], totalProseCount: 0 });
  });
});
