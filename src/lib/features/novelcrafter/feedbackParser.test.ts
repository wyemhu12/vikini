// /lib/features/novelcrafter/feedbackParser.test.ts
import { describe, expect, it } from "vitest";
import {
  applyFeedbackSuggestionToText,
  computeWordDiff,
  findQuoteRangeInText,
  parseFeedbackItems,
} from "./feedbackParser";

describe("feedbackParser (TC-04)", () => {
  it("TC-04 Case 4A: parses only closed <feedback_item> blocks when isStreaming is true", () => {
    const partialStream = [
      "<feedback_item>",
      "<category>consistency</category>",
      "<quote>Gwen Stacy swung through Manhattan.</quote>",
      "<comment>Contradicts the fantasy Story Bible setting.</comment>",
      "<suggestion>Snow White stepped over the mossy stones.</suggestion>",
      "</feedback_item>",
      "<feedback_item>",
      "<category>pacing</category>",
      "<quote>Incomplete block...",
    ].join("\n");

    const items = parseFeedbackItems(partialStream, { isStreaming: true, nowMs: 1000 });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "fb-1000-1",
      category: "CONSISTENCY",
      quote: "Gwen Stacy swung through Manhattan.",
      comment: "Contradicts the fantasy Story Bible setting.",
      suggestion: "Snow White stepped over the mossy stones.",
      status: "open",
      createdAt: 1001,
    });
  });

  it("TC-04 Case 4B: safely escapes regex metacharacters in findQuoteRangeInText and replaces first occurrence in applyFeedbackSuggestionToText", () => {
    const chapterText = "She whispered: Wait (here)? [No]* Never! Wait (here)? [No]* Again.";
    const quote = "Wait (here)? [No]*";

    const range = findQuoteRangeInText(chapterText, quote);
    expect(range).toEqual({ start: 15, end: 33 });

    const applied = applyFeedbackSuggestionToText(chapterText, quote, "Stay right here!");
    expect(applied.applied).toBe(true);
    expect(applied.updatedContent).toBe(
      "She whispered: Stay right here! Never! Wait (here)? [No]* Again."
    );

    // When quote was modified in editor and no longer matches
    const nonMatching = applyFeedbackSuggestionToText(
      "Completely different chapter text",
      quote,
      "Stay right here!"
    );
    expect(nonMatching).toEqual({
      updatedContent: "Completely different chapter text",
      applied: false,
    });
  });

  it("TC-04 Case 4C: computes word-level diff segments (equal, delete, insert)", () => {
    const diff = computeWordDiff("between her thighs, she", "between her legs, she");
    expect(diff).toEqual([
      { type: "equal", text: "between her " },
      { type: "delete", text: "thighs," },
      { type: "insert", text: "legs," },
      { type: "equal", text: " she" },
    ]);
  });
});
