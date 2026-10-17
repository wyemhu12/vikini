// /lib/features/novelcrafter/openingsParser.test.ts
import { describe, expect, it } from "vitest";
import { parseThreeOpenings } from "./openingsParser";

describe("parseThreeOpenings", () => {
  it("parses bold-wrapped banner and heading delimiters cleanly without stray asterisks (TC-08)", () => {
    const rawOutput = [
      "=== **OPENING 1: Hành động kịch tính** ===",
      "Nội dung 1",
      "=== **OPENING 2: Đối thoại bí ẩn** ===",
      "Nội dung 2",
      "### **Phương án 3: Miêu tả nội tâm**",
      "Nội dung 3",
    ].join("\n");

    const parsed = parseThreeOpenings(rawOutput);

    expect(parsed).toEqual([
      { label: "Opening 1: Hành động kịch tính", content: "Nội dung 1" },
      { label: "Opening 2: Đối thoại bí ẩn", content: "Nội dung 2" },
      { label: "Opening 3: Miêu tả nội tâm", content: "Nội dung 3" },
    ]);
  });

  it("falls back to a single Opening 1 item when fewer than 2 delimiters match", () => {
    const singleProse = "Một đoạn mở đầu duy nhất không chia thành nhiều phương án.";
    expect(parseThreeOpenings(singleProse)).toEqual([{ label: "Opening 1", content: singleProse }]);
  });

  it("returns empty array when rawOutput is empty or whitespace", () => {
    expect(parseThreeOpenings("   \n  ")).toEqual([]);
  });
});
