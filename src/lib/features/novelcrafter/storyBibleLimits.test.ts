// /lib/features/novelcrafter/storyBibleLimits.test.ts
import { describe, expect, it } from "vitest";
import { StoryBibleSchema } from "./types";
import { CHARACTER_DETAIL_MAX_CHARS, normalizeStoryBible } from "./storyBibleLimits";

describe("storyBibleLimits (5C TC-04)", () => {
  it("preserves section & per-field visibility booleans and clamps 4 character detail fields to 2,000 chars", () => {
    const oversized = "K".repeat(CHARACTER_DETAIL_MAX_CHARS + 450);
    const normalized = normalizeStoryBible({
      braindump: "Ý tưởng gốc",
      braindumpVisibleToAI: false,
      genre: "Hiện thực",
      genreVisibleToAI: false,
      style: "Câu ngắn",
      styleVisibleToAI: true,
      synopsis: "Tóm tắt",
      synopsisVisibleToAI: false,
      outline: "Ba hồi",
      outlineVisibleToAI: false,
      charactersVisibleToAI: true,
      worldbuildingVisibleToAI: false,
      characterCards: [
        {
          id: "char-1",
          name: "Ông Tư",
          role: "Lái đò",
          appearance: oversized,
          appearanceVisibleToAI: true,
          traits: oversized,
          traitsVisibleToAI: false,
          relationships: oversized,
          relationshipsVisibleToAI: true,
          secret: oversized,
          secretVisibleToAI: true,
          visibleToAI: true,
        },
        {
          id: "legacy-char",
          name: "Lam",
          traits: "Kiệm lời",
        },
      ],
    });

    const parsed = StoryBibleSchema.parse(normalized);
    expect(parsed.braindumpVisibleToAI).toBe(false);
    expect(parsed.genreVisibleToAI).toBe(false);
    expect(parsed.styleVisibleToAI).toBe(true);
    expect(parsed.synopsisVisibleToAI).toBe(false);
    expect(parsed.outlineVisibleToAI).toBe(false);
    expect(parsed.worldbuildingVisibleToAI).toBe(false);

    const card = parsed.characterCards[0];
    expect(card?.appearance?.length).toBe(2_000);
    expect(card?.traits.length).toBe(2_000);
    expect(card?.relationships?.length).toBe(2_000);
    expect(card?.secret?.length).toBe(2_000);
    expect(card?.traitsVisibleToAI).toBe(false);
    expect(card?.secretVisibleToAI).toBe(true);

    // Legacy card without new fields normalizes cleanly
    const legacy = parsed.characterCards[1];
    expect(legacy?.name).toBe("Lam");
    expect(legacy?.traits).toBe("Kiệm lời");
    expect(legacy?.visibleToAI).toBe(true);
    expect(legacy?.secretVisibleToAI).toBeUndefined();
  });
});
