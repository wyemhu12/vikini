// /lib/features/novelcrafter/codexMatcher.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  doesCodexTermMatchContext,
  findCodexMentionRanges,
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

  describe("findCodexMentionRanges (TC-CODEX)", () => {
    it("CX-1: matches longest alias first without overlapping shorter name ('Tiểu Minh' before 'Minh')", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: [
          {
            id: "char_minh",
            name: "Minh",
            aliases: ["Tiểu Minh"],
            role: "Lead",
            traits: "",
            visibleToAI: true,
          },
        ],
      };
      const text = "Tiểu Minh gặp Minh.";
      const ranges = findCodexMentionRanges(storyBible, text);
      expect(ranges).toEqual([
        {
          entityId: "char_minh",
          entityKind: "character",
          start: 0,
          end: 9,
        },
        {
          entityId: "char_minh",
          entityKind: "character",
          start: 14,
          end: 18,
        },
      ]);
    });

    it("CX-2: enforces Unicode letter boundaries and does not match inside 'Minhanh'", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: [
          {
            id: "char_minh",
            name: "Minh",
            role: "Lead",
            traits: "",
            visibleToAI: true,
          },
        ],
      };
      expect(findCodexMentionRanges(storyBible, "Minhanh bước đi.")).toEqual([]);
    });

    it("CX-3: matches CJK terms without spaces ('李明')", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: [
          {
            id: "char_liming",
            name: "李明",
            role: "Lead",
            traits: "",
            visibleToAI: true,
          },
        ],
      };
      const ranges = findCodexMentionRanges(storyBible, "他叫李明。");
      expect(ranges).toEqual([
        {
          entityId: "char_liming",
          entityKind: "character",
          start: 2,
          end: 4,
        },
      ]);
    });

    it("CX-4 (Negative): ignores 1-character names and safely escapes regex metacharacters ('C++ (x)')", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: [
          {
            id: "char_one",
            name: "A",
            role: "Skip",
            traits: "",
            visibleToAI: true,
          },
          {
            id: "char_meta",
            name: "C++ (x)",
            role: "Tech",
            traits: "",
            visibleToAI: true,
          },
        ],
      };
      const text = "A uses C++ (x) in battle.";
      const ranges = findCodexMentionRanges(storyBible, text);
      expect(ranges).toEqual([
        {
          entityId: "char_meta",
          entityKind: "character",
          start: 7,
          end: 14,
        },
      ]);
    });

    it("CX-5: caps returned mention ranges at maxRanges (default 2000)", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: Array.from({ length: 15 }, (_, i) => ({
          id: `c_${i}`,
          name: `NhânVật${i}`,
          aliases: Array.from({ length: 10 }, (__, j) => `BiệtDanh${i}_${j}`),
          role: "",
          traits: "",
          visibleToAI: true,
        })),
      };
      const repeated = "NhânVật0 ".repeat(5000);
      const ranges = findCodexMentionRanges(storyBible, repeated);
      expect(ranges).toHaveLength(2000);
    });

    it("CX-6: tags worldbuilding elements with entityKind 'world'", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        worldElements: [
          {
            id: "world_ht",
            name: "Hà Thành",
            category: "City",
            description: "",
            visibleToAI: true,
          },
        ],
      };
      const ranges = findCodexMentionRanges(storyBible, "Đêm mưa ở Hà Thành.");
      expect(ranges).toEqual([
        {
          entityId: "world_ht",
          entityKind: "world",
          start: 10,
          end: 18,
        },
      ]);
    });

    it("TC-W2A-21: hoists contextText.normalize('NFC') once across 20 cards x 3 aliases with NFD Vietnamese text", () => {
      const manyCards: StoryBibleCharacterCard[] = Array.from({ length: 20 }, (_, i) => ({
        id: `char_${i}`,
        name: `Nhân Vật ${i}`,
        aliases: [`Biệt Danh ${i}A`, `Biệt Danh ${i}B`, `Biệt Danh ${i}C`],
        role: "Support",
        traits: "",
        visibleToAI: true,
        alwaysInclude: false,
      }));
      manyCards[17].aliases = ["Tiểu Hàn", "Kiếm Đế", "Biệt Danh 17C"];

      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: manyCards,
      };
      // NFD decomposed Vietnamese context text
      const nfdContext = "Tiểu Hàn bước vào rừng sương.".normalize("NFD");

      const originalNormalize = String.prototype.normalize;
      let contextNormalizeCalls = 0;
      const normalizeSpy = vi.spyOn(String.prototype, "normalize").mockImplementation(function (
        this: string,
        form?: string
      ) {
        if (this === nfdContext) {
          contextNormalizeCalls += 1;
        }
        return originalNormalize.call(this, form);
      });

      try {
        const result = matchCodexEntitiesInContext(storyBible, nfdContext);
        expect(result.matchedCharacterIds.has("char_17")).toBe(true);
        expect(result.matchedCharacterIds.size).toBe(1);
        expect(contextNormalizeCalls).toBe(1);
      } finally {
        normalizeSpy.mockRestore();
      }
    });

    it("TC-W2A-21: handles Turkish dotted İ (U+0130) lowercase length expansion and 5,000 overlapping candidates with Uint8Array occupied mask", () => {
      const storyBible = {
        ...createDefaultStoryState().storyBible,
        characterCards: [
          {
            id: "char_hero",
            name: "Minh",
            aliases: ["Tiểu Minh", "Đại Ca Tiểu Minh"],
            role: "Lead",
            traits: "",
            visibleToAI: true,
          },
        ],
      };

      // İ (U+0130) expands from 1 UTF-16 code unit to 2 code units when lowercased ("i\u0307")
      const turkishPrefix = "İstanbul ".repeat(5);
      const repeatedOverlaps = `${turkishPrefix}${"Đại Ca Tiểu Minh ".repeat(2000)}`;
      const startedAt = performance.now();
      const ranges = findCodexMentionRanges(storyBible, repeatedOverlaps, 2000);
      const elapsedMs = performance.now() - startedAt;

      expect(ranges).toHaveLength(2000);
      // Every selected range must be the longest alias ("Đại Ca Tiểu Minh", length 16) with zero overlaps
      for (let i = 0; i < ranges.length; i += 1) {
        expect(ranges[i].end - ranges[i].start).toBe("Đại Ca Tiểu Minh".length);
        if (i > 0) {
          expect(ranges[i].start).toBeGreaterThanOrEqual(ranges[i - 1].end);
        }
      }
      expect(elapsedMs).toBeLessThan(1000);
      expect(findCodexMentionRanges(storyBible, "", 2000)).toEqual([]);
      expect(findCodexMentionRanges(storyBible, "Minh", 0)).toEqual([]);
    });
  });
});
