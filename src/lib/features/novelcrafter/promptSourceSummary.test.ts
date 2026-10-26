// /lib/features/novelcrafter/promptSourceSummary.test.ts
import { describe, expect, it } from "vitest";
import { ALL_PROMPT_ACTION_KEYS, type NovelcrafterPromptActionKey } from "./promptActions";
import { createDefaultPromptStudioSettings } from "./promptStudioSettings";
import { resolvePromptSourceSummary } from "./promptSourceSummary";

describe("promptSourceSummary", () => {
  it("TC-PSS-01: bible:synopsis generate mode includes genre and braindump fixed input", () => {
    const settings = createDefaultPromptStudioSettings();
    const res = resolvePromptSourceSummary("bible:synopsis", settings, { actionMode: "generate" });
    expect(res.storyBibleNodes).toEqual(["genre"]);
    expect(res.chapterContextNodes).toEqual([]);
    expect(res.fixedInputs).toEqual(["braindump"]);
    expect(res.isCustomized).toBe(false);
    expect(res.hasCustomDirective).toBe(false);
    expect(res.hasCustomContextNodes).toBe(false);
  });

  it("TC-PSS-02: bible:synopsis rewrite mode replaces braindump with current_section", () => {
    const settings = createDefaultPromptStudioSettings();
    const res = resolvePromptSourceSummary("bible:synopsis", settings, { actionMode: "rewrite" });
    expect(res.storyBibleNodes).toEqual(["genre"]);
    expect(res.chapterContextNodes).toEqual([]);
    expect(res.fixedInputs).toEqual(["current_section"]);
    expect(res.isCustomized).toBe(false);
  });

  it("TC-PSS-03: bible:characters rewrite mode includes synopsis and current_section", () => {
    const settings = createDefaultPromptStudioSettings();
    const res = resolvePromptSourceSummary("bible:characters", settings, { actionMode: "rewrite" });
    expect(res.storyBibleNodes).toEqual(["synopsis"]);
    expect(res.chapterContextNodes).toEqual([]);
    expect(res.fixedInputs).toEqual(["current_section"]);
  });

  it("TC-PSS-04: write:auto default settings partition 5 storyBibleNodes and 4 chapterContextNodes", () => {
    const settings = createDefaultPromptStudioSettings();
    const res = resolvePromptSourceSummary("write:auto", settings);
    expect(res.storyBibleNodes).toEqual([
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
    ]);
    expect(res.chapterContextNodes).toEqual([
      "story_so_far",
      "scenes",
      "previous_chapter_continuity",
      "preceding_prose",
    ]);
    expect(res.fixedInputs).toEqual([]);
    expect(res.isCustomized).toBe(false);
  });

  it("TC-PSS-05: write:guided includes guided_notes fixed input", () => {
    const settings = createDefaultPromptStudioSettings();
    const res = resolvePromptSourceSummary("write:guided", settings);
    expect(res.fixedInputs).toEqual(["guided_notes"]);
    expect(res.storyBibleNodes).toEqual([
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
    ]);
    expect(res.chapterContextNodes).toEqual([
      "story_so_far",
      "scenes",
      "previous_chapter_continuity",
      "preceding_prose",
    ]);
  });

  it("TC-PSS-06: rewrite:rephrase and expand:* include selected_text fixed input", () => {
    const settings = createDefaultPromptStudioSettings();
    const rewriteRes = resolvePromptSourceSummary("rewrite:rephrase", settings);
    expect(rewriteRes.storyBibleNodes).toEqual(["style", "genre", "pov_tense"]);
    expect(rewriteRes.chapterContextNodes).toEqual(["preceding_prose"]);
    expect(rewriteRes.fixedInputs).toEqual(["selected_text"]);

    const expandRes = resolvePromptSourceSummary("expand:describe", settings);
    expect(expandRes.fixedInputs).toEqual(["selected_text"]);
    expect(expandRes.storyBibleNodes).toEqual([
      "characters",
      "worldbuilding",
      "style",
      "genre",
      "pov_tense",
    ]);
    expect(expandRes.chapterContextNodes).toEqual(["preceding_prose"]);
  });

  it("TC-PSS-07: custom contextNodes override automatically enforces required nodes", () => {
    const settings = {
      ...createDefaultPromptStudioSettings(),
      overrides: {
        "write:auto": {
          contextNodes: ["style", "scenes"] as const,
        },
      },
    };
    const res = resolvePromptSourceSummary("write:auto", {
      ...settings,
      overrides: {
        "write:auto": { contextNodes: ["style", "scenes"] },
      },
    });
    expect(res.storyBibleNodes).toEqual(["style"]);
    expect(res.chapterContextNodes).toEqual(["scenes", "preceding_prose"]);
    expect(res.isCustomized).toBe(true);
    expect(res.hasCustomContextNodes).toBe(true);
    expect(res.hasCustomDirective).toBe(false);
  });

  it("TC-PSS-08: custom directive without contextNodes override preserves default nodes and sets flags", () => {
    const settings = {
      ...createDefaultPromptStudioSettings(),
      overrides: {
        "write:auto": {
          directive: "Custom direction",
        },
      },
    };
    const res = resolvePromptSourceSummary("write:auto", settings);
    expect(res.isCustomized).toBe(true);
    expect(res.hasCustomDirective).toBe(true);
    expect(res.hasCustomContextNodes).toBe(false);
    expect(res.storyBibleNodes).toHaveLength(5);
    expect(res.chapterContextNodes).toHaveLength(4);
  });

  it("TC-PSS-09: Negative Probe handles null/undefined settings or invalid actionKey safely without throwing", () => {
    const nullSettingsRes = resolvePromptSourceSummary("write:auto", null);
    expect(nullSettingsRes.isCustomized).toBe(false);
    expect(nullSettingsRes.storyBibleNodes.length).toBeGreaterThan(0);

    const invalidKey = "invalid:action" as unknown as NovelcrafterPromptActionKey;
    const invalidRes = resolvePromptSourceSummary(invalidKey, null);
    expect(invalidRes.isCustomized).toBe(false);
    expect(invalidRes.storyBibleNodes).toEqual([]);
    expect(invalidRes.chapterContextNodes).toEqual([]);
    expect(invalidRes.fixedInputs).toEqual([]);
  });

  it("resolves valid non-empty source summary for all 37 canonical prompt actions", () => {
    const settings = createDefaultPromptStudioSettings();
    for (const key of ALL_PROMPT_ACTION_KEYS) {
      const res = resolvePromptSourceSummary(key, settings);
      expect(res.actionKey).toBe(key);
      expect(res.effectiveNodes.length).toBeGreaterThan(0);
    }
  });
});
