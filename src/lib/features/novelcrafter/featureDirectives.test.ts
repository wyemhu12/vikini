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

  it("TC-06 Case 6A & 6B: includes chapterExtraInstructions across all 5 write modes, rewrite, and both expand modes, and rewrites structured cards when freeform notes are empty", () => {
    const extra = "Giữ giọng văn cổ phong";
    const writeModes = ["first_draft_rough", "openings_3", "tone_shift", "guided", "auto"] as const;

    for (const writeMode of writeModes) {
      const dir = buildFeatureDirective({
        feature: "write",
        storyBible: defaultBible,
        writeMode,
        chapterExtraInstructions: extra,
      });
      expect(dir).toContain(`Chapter Extra Instructions: ${extra}`);
    }

    const rewriteDir = buildFeatureDirective({
      feature: "rewrite",
      storyBible: defaultBible,
      selectedText: "Đoạn văn",
      chapterExtraInstructions: extra,
    });
    expect(rewriteDir).toContain(`Chapter Extra Instructions: ${extra}`);

    for (const expandMode of ["describe", "expand"] as const) {
      const expandDir = buildFeatureDirective({
        feature: "expand",
        storyBible: defaultBible,
        expandMode,
        selectedText: "Đoạn văn",
        chapterExtraInstructions: extra,
      });
      expect(expandDir).toContain(`Chapter Extra Instructions: ${extra}`);
    }

    // Case 6B: Bible rewrite with structured characterCards and empty free-form characters string
    const bibleWithStructuredCard = {
      ...defaultBible,
      characters: "",
      characterCards: [
        {
          id: "c1",
          name: "Linh",
          role: "Kiếm khách",
          traits: "Lạnh lùng",
          visibleToAI: true,
        },
      ],
    };

    const bibleRewrite = buildFeatureDirective({
      feature: "bible",
      bibleTarget: "characters",
      actionMode: "rewrite",
      storyBible: bibleWithStructuredCard,
    });
    expect(bibleRewrite).toContain("### Linh (Kiếm khách)");
    expect(bibleRewrite).toContain("Lạnh lùng");
  });

  it("TC-303: builds chapter_summary directive in generate and rewrite modes and throws when chapterProse and chapterScenes are both empty", () => {
    expect(() =>
      buildFeatureDirective({
        feature: "bible",
        bibleTarget: "chapter_summary",
        actionMode: "generate",
        storyBible: defaultBible,
        chapterProse: "   ",
        chapterScenes: "",
      })
    ).toThrow(/chapterProse or chapterScenes is required/);

    const genDir = buildFeatureDirective({
      feature: "bible",
      bibleTarget: "chapter_summary",
      actionMode: "generate",
      storyBible: defaultBible,
      chapterProse: "Linh bước vào mật thất và tìm thấy cổ kiếm.",
    });
    expect(genDir).toContain("concise 3-to-5 bullet Rolling Chapter Summary");

    const rewriteDir = buildFeatureDirective({
      feature: "bible",
      bibleTarget: "chapter_summary",
      actionMode: "rewrite",
      storyBible: defaultBible,
      chapterSummary: "- Linh vào mật thất.",
    });
    expect(rewriteDir).toContain("- Linh vào mật thất.");
  });
});
