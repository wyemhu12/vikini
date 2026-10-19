// /lib/features/novelcrafter/codexMatcher.test.ts
import { describe, expect, it } from "vitest";
import {
  doesCodexTermMatchContext,
  formatAliasesInput,
  isCodexCardMatchedInContext,
  matchCodexEntitiesInContext,
  parseAliasesInput,
} from "./codexMatcher";
import {
  createDefaultStoryState,
  type StoryBibleCharacterCard,
  type StoryBibleWorldElement,
} from "./types";

describe("codexMatcher (Phase 3.1)", () => {
  describe("parseAliasesInput & formatAliasesInput", () => {
    it("parses comma/semicolon/newline separated aliases, trims, deduplicates case-insensitively, and enforces limits", () => {
      const raw = "  Tiểu Bạch , Lão Tổ;  tiểu bạch \n Kiếm Thần , , ";
      const parsed = parseAliasesInput(raw);
      expect(parsed).toEqual(["Tiểu Bạch", "Lão Tổ", "Kiếm Thần"]);
      expect(formatAliasesInput(parsed)).toBe("Tiểu Bạch, Lão Tổ, Kiếm Thần");
    });

    it("caps at MAX_CODEX_ALIASES (10) and truncates each alias to MAX_CODEX_ALIAS_CHARS (80)", () => {
      const longAlias = "A".repeat(120);
      const many = Array.from({ length: 15 }, (_, i) => `Alias-${i + 1}`).join(", ");
      const parsedMany = parseAliasesInput(`${longAlias}, ${many}`);
      expect(parsedMany).toHaveLength(10);
      expect(parsedMany[0]).toHaveLength(80);
    });

    it("returns empty string when formatting empty or undefined aliases", () => {
      expect(formatAliasesInput(undefined)).toBe("");
      expect(formatAliasesInput([])).toBe("");
    });
  });

  describe("doesCodexTermMatchContext", () => {
    it("matches whole words with Unicode boundaries (Vietnamese diacritics) and rejects partial substrings", () => {
      expect(doesCodexTermMatchContext("An", "Bình An bước vào đại điện.")).toBe(true);
      expect(doesCodexTermMatchContext("An", "Thanh âm vang vọng khắp núi rừng.")).toBe(false);
      expect(doesCodexTermMatchContext("Lâm Phong", "Thiếu niên Lâm Phong rút kiếm.")).toBe(true);
    });

    it("ignores single-character terms (< 2 chars) to prevent false-positive token bloat", () => {
      expect(doesCodexTermMatchContext("A", "A bước vào phòng.")).toBe(false);
      expect(doesCodexTermMatchContext(" ", "Bất kỳ nội dung nào")).toBe(false);
    });

    it("supports CJK terms without spaces using substring fallback", () => {
      expect(doesCodexTermMatchContext("青云宗", "他来到了青云宗山门前。")).toBe(true);
      expect(doesCodexTermMatchContext("青云宗", "他来到了天魔宗山门前。")).toBe(false);
    });
  });

  describe("isCodexCardMatchedInContext & matchCodexEntitiesInContext", () => {
    const cards: StoryBibleCharacterCard[] = [
      {
        id: "c1",
        name: "Lâm Hàn",
        aliases: ["Tiểu Hàn", "Kiếm Đế"],
        role: "Main",
        traits: "Lạnh lùng",
        visibleToAI: true,
        alwaysInclude: false,
      },
      {
        id: "c2",
        name: "Tô Tuyết",
        aliases: ["Tuyết Nhi"],
        role: "Lead",
        traits: "Băng giá",
        visibleToAI: true,
        alwaysInclude: true,
      },
      {
        id: "c3",
        name: "Hắc Ma",
        aliases: ["Ma Tôn"],
        role: "Villain",
        traits: "Tàn nhẫn",
        visibleToAI: false,
        alwaysInclude: true,
      },
    ];

    const worldElements: StoryBibleWorldElement[] = [
      {
        id: "w1",
        name: "Vạn Kiếm Sơn",
        aliases: ["Kiếm Sơn"],
        category: "Location",
        description: "Thánh địa kiếm đạo",
        visibleToAI: true,
        alwaysInclude: false,
      },
      {
        id: "w2",
        name: "Huyết Hải",
        category: "Location",
        description: "Vùng biển máu",
        visibleToAI: true,
        alwaysInclude: false,
      },
    ];

    it("includes cards when activeContextText is undefined or empty (backward compatibility)", () => {
      expect(isCodexCardMatchedInContext(cards[0], undefined)).toBe(true);
      expect(isCodexCardMatchedInContext(cards[0], "   ")).toBe(true);
      expect(isCodexCardMatchedInContext(cards[2], undefined)).toBe(false); // visibleToAI is false
    });

    it("matches by alias or alwaysInclude and filters out unmatched entities when context is provided", () => {
      const context = "Tiểu Hàn ngước nhìn đỉnh Kiếm Sơn mờ sương.";
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: cards,
        worldElements,
      };
      const result = matchCodexEntitiesInContext(storyBible, context);

      expect(result.matchedCharacterIds.has("c1")).toBe(true); // Matched via alias "Tiểu Hàn"
      expect(result.matchedCharacterIds.has("c2")).toBe(true); // Matched via alwaysInclude: true
      expect(result.matchedCharacterIds.has("c3")).toBe(false); // Excluded via visibleToAI: false
      expect(result.matchedWorldElementIds.has("w1")).toBe(true); // Matched via alias "Kiếm Sơn"
      expect(result.matchedWorldElementIds.has("w2")).toBe(false); // Unmatched
    });
  });
});
