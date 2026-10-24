// /lib/features/novelcrafter/feedbackParser.test.ts
import { describe, expect, it } from "vitest";
import {
  applyFeedbackSuggestionToText,
  buildFeedbackReplyInstruction,
  computeWordDiff,
  findQuoteRangeInText,
  mergeStreamedFeedbackItems,
  parseFeedbackItems,
} from "./feedbackParser";
import {
  createDefaultStoryState,
  MAX_CUSTOM_INSTRUCTION_CHARS,
  NovelcrafterStreamRequestSchema,
  type NovelcrafterFeedbackItem,
} from "./types";

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

  it("TC-04 Case 4D: falls back to an EDITORIAL card when !isStreaming and plain text has no <feedback_item> tags", () => {
    const fallbackItems = parseFeedbackItems(
      "I cannot fulfill this request due to content guidelines.",
      { isStreaming: false, nowMs: 2000 }
    );
    expect(fallbackItems).toHaveLength(1);
    expect(fallbackItems[0]).toEqual({
      id: "fb-2000-1",
      category: "EDITORIAL",
      quote: "",
      comment: "I cannot fulfill this request due to content guidelines.",
      suggestion: "",
      status: "open",
      createdAt: 2000,
    });
  });

  it("TC-10 Case 10A & 10B: mergeStreamedFeedbackItems preserves resolved/replied cards in normal mode and keeps all base cards in reply mode", () => {
    const baseItems: NovelcrafterFeedbackItem[] = [
      {
        id: "fb-resolved",
        category: "PACING",
        quote: "Old quote 1",
        comment: "Resolved comment",
        suggestion: "",
        status: "resolved",
        createdAt: 100,
      },
      {
        id: "fb-replied",
        category: "CONSISTENCY",
        quote: "Old quote 2",
        comment: "Replied comment",
        suggestion: "",
        status: "open",
        userReply: "Đã sửa",
        createdAt: 200,
      },
      {
        id: "fb-untouched",
        category: "STYLE",
        quote: "Old quote 3",
        comment: "Untouched open comment",
        suggestion: "",
        status: "open",
        createdAt: 300,
      },
    ];

    const parsedItems: NovelcrafterFeedbackItem[] = [
      {
        id: "fb-new-1",
        category: "PROSE",
        quote: "New quote",
        comment: "Fresh critique",
        suggestion: "Better wording",
        status: "open",
        createdAt: 400,
      },
    ];

    // Case 10A: Normal mode replaces untouched open card but preserves resolved & replied cards
    const normalMerged = mergeStreamedFeedbackItems({
      baseItems,
      parsedItems,
      isReplyMode: false,
    });
    expect(normalMerged.map((i) => i.id)).toEqual(["fb-new-1", "fb-resolved", "fb-replied"]);

    // Case 10B: Reply mode keeps all baseItems and prepends parsedItems
    const replyMerged = mergeStreamedFeedbackItems({
      baseItems,
      parsedItems,
      isReplyMode: true,
    });
    expect(replyMerged.map((i) => i.id)).toEqual([
      "fb-new-1",
      "fb-resolved",
      "fb-replied",
      "fb-untouched",
    ]);
  });

  it("TC-307: computes accurate word-level diff on large chapters (>500 words) via common prefix/suffix stripping without falling back to full replacement", () => {
    const prefixWords = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const suffixWords = Array.from({ length: 300 }, (_, i) => `tail${i}`).join(" ");
    const oldText = `${prefixWords} oldPhraseHere ${suffixWords}`;
    const newText = `${prefixWords} newPhraseHere ${suffixWords}`;

    const segments = computeWordDiff(oldText, newText);
    expect(segments).toEqual([
      { type: "equal", text: `${prefixWords} ` },
      { type: "delete", text: "oldPhraseHere" },
      { type: "insert", text: "newPhraseHere" },
      { type: "equal", text: ` ${suffixWords}` },
    ]);
  });

  it("TC-B3-07: unescapes XML entities in <quote>, <comment>, and <suggestion> so findQuoteRangeInText matches raw chapter prose", () => {
    const rawStream = [
      "<feedback_item>",
      "<category>prose</category>",
      "<quote>Tom &amp; Jerry &lt;whispered&gt;</quote>",
      "<comment>Avoid &lt;brackets&gt; &amp; clichés</comment>",
      "<suggestion>Tom and Jerry whispered</suggestion>",
      "</feedback_item>",
    ].join("\n");

    const items = parseFeedbackItems(rawStream, { isStreaming: false, nowMs: 3000 });
    expect(items).toHaveLength(1);
    expect(items[0]?.quote).toBe("Tom & Jerry <whispered>");
    expect(items[0]?.comment).toBe("Avoid <brackets> & clichés");
    expect(
      findQuoteRangeInText("In the dark, Tom & Jerry <whispered> softly.", items[0]!.quote)
    ).not.toBeNull();
  });

  it("TC-B6-02, TC-B6-03, TC-B6-04: buildFeedbackReplyInstruction clamps comment and replyText and stays within MAX_CUSTOM_INSTRUCTION_CHARS", () => {
    // TC-B6-02: oversized clamping (20,000 + 5,000) -> exact clamped length 10_000 + 17 + 2_000 = 12_017
    const clamped = buildFeedbackReplyInstruction("c".repeat(20_000), "r".repeat(5_000));
    expect(clamped.reply).toHaveLength(2_000);
    expect(clamped.instruction).toHaveLength(10_000 + 17 + 2_000);
    expect(clamped.instruction.length).toBeLessThanOrEqual(MAX_CUSTOM_INSTRUCTION_CHARS);
    expect(clamped.instruction.startsWith("c".repeat(10_000) + "\nUser follow-up: ")).toBe(true);

    // TC-B6-03: normal lengths preserved verbatim
    const normal = buildFeedbackReplyInstruction(" Câu hỏi ", " Sửa giúp ");
    expect(normal).toEqual({
      reply: "Sửa giúp",
      instruction: "Câu hỏi\nUser follow-up: Sửa giúp",
    });

    // TC-B6-04: worst-case end-to-end passes NovelcrafterStreamRequestSchema
    const parsed = NovelcrafterStreamRequestSchema.safeParse({
      conversationId: "123e4567-e89b-12d3-a456-426614174000",
      model: "gemini-2.5-flash",
      feature: "feedback",
      routing: createDefaultStoryState().routing,
      storyBible: createDefaultStoryState().storyBible,
      chapterProse: "Prose",
      customInstruction: clamped.instruction,
    });
    expect(parsed.success).toBe(true);
  });
});
