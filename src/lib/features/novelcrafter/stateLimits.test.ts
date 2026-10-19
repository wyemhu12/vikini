// /lib/features/novelcrafter/stateLimits.test.ts
import { describe, expect, it } from "vitest";
import { createDefaultStoryState, NovelcrafterStoryStateSchema } from "./types";
import {
  CARD_TRUNCATION_NOTICE,
  coerceStoryStateToLimits,
  FIELD_MAX_LENGTHS,
  normalizeChapterSnapshots,
  normalizeCodexAliases,
  normalizeFeedbackItems,
  stripCardTruncationNotice,
  truncateText,
  truncateTextWithNotice,
} from "./stateLimits";

describe("stateLimits", () => {
  it("TC-01: coerces oversized fields without wiping the entire story state", () => {
    const base = createDefaultStoryState("gemini-2.5-flash");
    const oversizedProse = "A".repeat(FIELD_MAX_LENGTHS.chapterContent + 5000);
    const oversizedCard = "B".repeat(FIELD_MAX_LENGTHS.historyCardContent + 1000);

    const raw = {
      ...base,
      storyBible: {
        ...base.storyBible,
        braindump: "C".repeat(FIELD_MAX_LENGTHS.braindump + 500),
      },
      chapters: [
        {
          ...base.chapters[0],
          title: "Valid Chapter 1",
          content: oversizedProse,
        },
      ],
      historyCards: [
        {
          id: "card-1",
          feature: "write",
          subLabel: "Auto Write",
          content: oversizedCard,
          model: "gemini-4-argon",
          gemName: null,
          personaName: null,
          createdAt: 1700000000000,
        },
      ],
    };

    const coercedRaw = coerceStoryStateToLimits(raw, "Chapter 1");
    expect(coercedRaw).not.toBeNull();
    const parsed = NovelcrafterStoryStateSchema.parse(coercedRaw);

    expect(parsed.chapters).toHaveLength(1);
    expect(parsed.chapters[0].title).toBe("Valid Chapter 1");
    expect(parsed.chapters[0].content.length).toBe(FIELD_MAX_LENGTHS.chapterContent);
    expect(parsed.storyBible.braindump.length).toBe(FIELD_MAX_LENGTHS.braindump);
    expect(parsed.historyCards).toHaveLength(1);
    expect(parsed.historyCards[0].content.length).toBeLessThanOrEqual(
      FIELD_MAX_LENGTHS.historyCardContent
    );
    expect(parsed.historyCards[0].content.endsWith(CARD_TRUNCATION_NOTICE)).toBe(true);
  });

  it("strips card truncation notice cleanly before appending or replacing prose", () => {
    const sample = truncateTextWithNotice("Hello world ".repeat(5000), 200);
    expect(sample.endsWith(CARD_TRUNCATION_NOTICE)).toBe(true);
    const stripped = stripCardTruncationNotice(sample);
    expect(stripped.includes(CARD_TRUNCATION_NOTICE.trim())).toBe(false);
    expect(stripped.startsWith("Hello world")).toBe(true);
  });

  it("truncates text and normalizes feedback items safely", () => {
    expect(truncateText("abcdef", 3)).toBe("abc");
    const items = normalizeFeedbackItems([
      {
        id: "fb-1",
        category: "pacing",
        quote: "Sample quote",
        comment: "Good pacing",
        suggestion: "Tighten scene",
        status: "open",
      },
      { invalid: true },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("fb-1");
  });

  it("TC-305: normalizes Codex aliases and Chapter Snapshots within strict schema limits", () => {
    const aliases = normalizeCodexAliases(["  Tiểu Bạch ", "tiểu bạch", "", "X".repeat(120)]);
    expect(aliases).toEqual(["Tiểu Bạch", "X".repeat(FIELD_MAX_LENGTHS.codexAlias)]);
    expect(normalizeCodexAliases([])).toBeUndefined();

    const rawSnaps = Array.from({ length: 8 }, (_, idx) => ({
      id: `snap-${idx}`,
      label: `Bản lưu ${idx}`,
      content: "Nội dung chương",
      wordCount: 3,
      createdAt: 1000 + idx,
    }));
    const snaps = normalizeChapterSnapshots(rawSnaps);
    expect(snaps).toHaveLength(5);
    expect(snaps?.[0].id).toBe("snap-0");
  });
});
