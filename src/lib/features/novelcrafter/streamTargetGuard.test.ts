// /lib/features/novelcrafter/streamTargetGuard.test.ts
import { describe, expect, it } from "vitest";
import {
  applyStreamTargetUpdate,
  isLikelyModelRefusalOutput,
  resolveStreamTerminationState,
} from "./streamTargetGuard";
import { createDefaultStoryState } from "./types";

describe("streamTargetGuard (TC-07)", () => {
  it("TC-07 Case 7A (M13): prevents cross-story write when switching stories that share chapter id 'ch-1'", () => {
    const stateB = createDefaultStoryState("Chapter 1 of Story B");
    stateB.chapters[0].content = "Existing Story B content";

    const result = applyStreamTargetUpdate(
      { ownerStoryId: "story-B", state: stateB },
      {
        storyId: "story-A",
        kind: "chapter_prose",
        chapterId: "ch-1",
        baseContent: "Story A base",
      },
      "Streamed Story A prose",
      5000
    );

    expect(result.applied).toBe(false);
    expect(result.nextState.chapters[0].content).toBe("Existing Story B content");
  });

  it("TC-07 Case 7A (M13): applies live streamed tokens to matching storyId and chapterId", () => {
    const stateA = createDefaultStoryState("Chapter 1 of Story A");
    stateA.chapters[0].content = "Opening line.";

    const result = applyStreamTargetUpdate(
      { ownerStoryId: "story-A", state: stateA },
      {
        storyId: "story-A",
        kind: "chapter_prose",
        chapterId: "ch-1",
        baseContent: "Opening line.",
      },
      "Second paragraph from AI.",
      6000
    );

    expect(result.applied).toBe(true);
    expect(result.nextState.chapters[0].content).toBe("Opening line.\n\nSecond paragraph from AI.");
  });

  it("TC-07 Case 7B (M13): preserves partial streamed text on stop or mid-stream error after tokens arrive, and restores baseContent if error happens before first token", () => {
    const stopped = resolveStreamTerminationState({
      reason: "stopped",
      baseContent: "Intro.",
      accumulatedStreamText: "Partial AI output",
      isAppendMode: true,
    });
    expect(stopped).toEqual({
      finalFieldContent: "Intro.\n\nPartial AI output",
      shouldSavePartialHistory: true,
      shouldPersistState: true,
    });

    const errorAfterTokens = resolveStreamTerminationState({
      reason: "error",
      baseContent: "Intro.",
      accumulatedStreamText: "Half a chapter",
      isAppendMode: true,
    });
    expect(errorAfterTokens).toEqual({
      finalFieldContent: "Intro.\n\nHalf a chapter",
      shouldSavePartialHistory: true,
      shouldPersistState: true,
    });

    const errorBeforeTokens = resolveStreamTerminationState({
      reason: "error",
      baseContent: "Intro.",
      accumulatedStreamText: "   ",
      isAppendMode: true,
    });
    expect(errorBeforeTokens).toEqual({
      finalFieldContent: "Intro.",
      shouldSavePartialHistory: false,
      shouldPersistState: false,
    });
  });

  it("TC-10: detects LLM refusal outputs and restores baseContent without persisting to DB", () => {
    expect(
      isLikelyModelRefusalOutput(
        "I cannot fulfill this request. I am programmed to follow safety guidelines."
      )
    ).toBe(true);
    expect(isLikelyModelRefusalOutput("I'm sorry, Deal/LO, I cannot fulfill this request.")).toBe(
      true
    );
    expect(isLikelyModelRefusalOutput("As an AI, ARIA monitored the ship's sensors.")).toBe(false);
    expect(isLikelyModelRefusalOutput("As an AI assistant, I cannot generate this content.")).toBe(
      true
    );

    const refusalResolution = resolveStreamTerminationState({
      reason: "completed",
      baseContent: "Original 23,000-character chapter prose.",
      accumulatedStreamText:
        "I cannot fulfill this request. I am unable to continue this fictional scene.",
      isAppendMode: true,
    });

    expect(refusalResolution).toEqual({
      finalFieldContent: "Original 23,000-character chapter prose.",
      shouldSavePartialHistory: false,
      shouldPersistState: false,
      refusalDetected: true,
      refusalMessage:
        "I cannot fulfill this request. I am unable to continue this fictional scene.",
    });
  });
});
