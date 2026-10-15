// /lib/features/novelcrafter/featureDirectives.test.ts
import { describe, expect, it } from "vitest";
import { buildFeatureDirective } from "./featureDirectives";
import { createDefaultStoryState } from "./types";

describe("featureDirectives (TC-05 Cases 5A & 5B)", () => {
  const defaultBible = createDefaultStoryState().storyBible;

  it("TC-05 Case 5A: builds Feedback directive for beta_read (Maya, Anton, Joan) and developmental criteria", () => {
    const betaRead = buildFeatureDirective({
      feature: "feedback",
      storyBible: defaultBible,
      chapterProse: "Elara stepped through the portal.",
      feedbackMode: "beta_read",
    });
    expect(betaRead).toContain("MAYA");
    expect(betaRead).toContain("ANTON");
    expect(betaRead).toContain("JOAN");
    expect(betaRead).toContain("<feedback_item>");

    const developmental = buildFeatureDirective({
      feature: "feedback",
      storyBible: defaultBible,
      chapterProse: "Elara stepped through the portal.",
      feedbackMode: "developmental",
      feedbackCriteria: ["consistency", "pacing"],
    });
    expect(developmental).toContain("CONSISTENCY");
    expect(developmental).toContain("PACING");
    expect(developmental).not.toContain("ORIGINALITY");
  });

  it("TC-05 Case 5A: throws ValidationError when feedback has neither chapterProse nor selectedText", () => {
    expect(() =>
      buildFeatureDirective({
        feature: "feedback",
        storyBible: defaultBible,
        chapterProse: "   ",
        selectedText: "",
      })
    ).toThrow(/chapterProse or selectedText is required/);
  });

  it("TC-05 Case 5B: builds Write tone_shift directive with target word length and Rewrite more_intense directive", () => {
    const toneShift = buildFeatureDirective({
      feature: "write",
      storyBible: defaultBible,
      writeMode: "tone_shift",
      toneShift: "ominous",
      writeLengthWords: 600,
    });
    expect(toneShift).toContain("Ominous");
    expect(toneShift).toContain("600 words");

    const moreIntense = buildFeatureDirective({
      feature: "rewrite",
      storyBible: defaultBible,
      selectedText: "He ran down the hall.",
      rewriteMode: "more_intense",
    });
    expect(moreIntense).toContain("more intense, visceral, and gripping");
  });
});
