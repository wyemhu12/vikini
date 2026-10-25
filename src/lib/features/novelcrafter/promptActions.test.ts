// /lib/features/novelcrafter/promptActions.test.ts
import { describe, expect, it } from "vitest";
import {
  ALL_PROMPT_ACTION_KEYS,
  getDefaultContextNodes,
  getRequiredContextNodes,
  isPromptActionKey,
  PROMPT_ACTION_GROUPS,
  resolveEffectiveContextNodes,
  resolvePromptActionKey,
} from "./promptActions";

describe("promptActions (AK-01..AK-06)", () => {
  it("AK-01: enumerates all 37 unique action keys across 6 feature groups", () => {
    const flattened = PROMPT_ACTION_GROUPS.flatMap((group) => group.keys);
    expect(flattened).toHaveLength(37);
    expect(new Set(flattened).size).toBe(37);
    expect(ALL_PROMPT_ACTION_KEYS).toHaveLength(37);
    for (const key of ALL_PROMPT_ACTION_KEYS) {
      expect(isPromptActionKey(key)).toBe(true);
    }
    expect(isPromptActionKey("write:unknown")).toBe(false);
  });

  it("AK-02: resolvePromptActionKey maps every feature and mode combination to the exact key", () => {
    expect(resolvePromptActionKey({ feature: "bible", bibleTarget: "draft" })).toBe("bible:draft");
    expect(resolvePromptActionKey({ feature: "bible" })).toBeNull();
    expect(resolvePromptActionKey({ feature: "write", writeMode: "tone_shift" })).toBe(
      "write:tone_shift"
    );
    expect(resolvePromptActionKey({ feature: "write" })).toBe("write:auto");
    expect(resolvePromptActionKey({ feature: "rewrite", rewriteMode: "show_dont_tell" })).toBe(
      "rewrite:show_dont_tell"
    );
    expect(resolvePromptActionKey({ feature: "rewrite" })).toBe("rewrite:rephrase");
    expect(resolvePromptActionKey({ feature: "expand", expandMode: "describe" })).toBe(
      "expand:describe"
    );
    expect(resolvePromptActionKey({ feature: "expand" })).toBe("expand:expand");
    expect(resolvePromptActionKey({ feature: "feedback", feedbackMode: "beta_read" })).toBe(
      "feedback:beta_read"
    );
    expect(resolvePromptActionKey({ feature: "feedback" })).toBe("feedback:developmental");
    expect(
      resolvePromptActionKey({ feature: "brainstorm", brainstormCategory: "magic_systems" })
    ).toBe("brainstorm:magic_systems");
    expect(resolvePromptActionKey({ feature: "brainstorm" })).toBe("brainstorm:plot_twists");
  });

  it("AK-03: getDefaultContextNodes('bible:draft') includes synopsis and outline alongside style, genre, pov_tense, characters, worldbuilding, story_so_far, scenes", () => {
    expect(getDefaultContextNodes("bible:draft")).toEqual([
      "synopsis",
      "outline",
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
      "story_so_far",
      "scenes",
    ]);
  });

  it("AK-04: getDefaultContextNodes('write:auto') omits synopsis and outline by default while keeping continuity and preceding_prose", () => {
    const nodes = getDefaultContextNodes("write:auto");
    expect(nodes).not.toContain("synopsis");
    expect(nodes).not.toContain("outline");
    expect(nodes).toEqual([
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
      "story_so_far",
      "scenes",
      "previous_chapter_continuity",
      "preceding_prose",
    ]);
  });

  it("AK-05 & AK-06: resolveEffectiveContextNodes unions required nodes for bible:chapter_summary and feedback modes even when customNodes=[]", () => {
    expect(getRequiredContextNodes("bible:chapter_summary")).toEqual(["scenes", "preceding_prose"]);
    expect(resolveEffectiveContextNodes("bible:chapter_summary", [])).toEqual([
      "scenes",
      "preceding_prose",
    ]);

    for (const key of [
      "feedback:developmental",
      "feedback:line_editing",
      "feedback:beta_read",
    ] as const) {
      expect(getRequiredContextNodes(key)).toEqual(["preceding_prose"]);
      expect(resolveEffectiveContextNodes(key, [])).toEqual(["preceding_prose"]);
    }
  });
});
