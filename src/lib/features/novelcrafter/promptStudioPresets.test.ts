// /lib/features/novelcrafter/promptStudioPresets.test.ts
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PROMPT_PRESETS,
  isBuiltInPresetId,
  NOVELCRAFTER_BUILT_IN_PRESET_IDS,
} from "./promptStudioPresets";
import { applyPreset, createDefaultPromptStudioSettings } from "./promptStudioSettings";

describe("promptStudioPresets (ST-08)", () => {
  it("ST-08: defines default, lean_context, and deep_continuity built-in presets and applies their overrides cleanly", () => {
    expect(NOVELCRAFTER_BUILT_IN_PRESET_IDS).toEqual([
      "default",
      "lean_context",
      "deep_continuity",
    ]);
    expect(isBuiltInPresetId("lean_context")).toBe(true);
    expect(isBuiltInPresetId("custom-123")).toBe(false);
    expect(Object.keys(BUILT_IN_PROMPT_PRESETS)).toEqual([
      "default",
      "lean_context",
      "deep_continuity",
    ]);

    const base = createDefaultPromptStudioSettings();
    const lean = applyPreset(base, "lean_context");
    expect(lean.activePresetId).toBe("lean_context");
    expect(lean.overrides["write:auto"]?.contextNodes).toEqual([
      "style",
      "genre",
      "pov_tense",
      "scenes",
      "preceding_prose",
    ]);

    const deep = applyPreset(lean, "deep_continuity");
    expect(deep.activePresetId).toBe("deep_continuity");
    expect(deep.overrides["write:auto"]?.contextNodes).toContain("synopsis");
    expect(deep.overrides["write:auto"]?.contextNodes).toContain("outline");

    const backToDefault = applyPreset(deep, "default");
    expect(backToDefault.activePresetId).toBe("default");
    expect(backToDefault.overrides).toEqual({});
  });
});
