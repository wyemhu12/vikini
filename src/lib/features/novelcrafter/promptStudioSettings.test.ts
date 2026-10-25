// /lib/features/novelcrafter/promptStudioSettings.test.ts
import { describe, expect, it } from "vitest";
import { getDefaultContextNodes } from "./promptActions";
import { DEFAULT_PROMPT_DIRECTIVES } from "./promptDirectiveDefaults";
import {
  applyPreset,
  buildStreamPromptOverridePayload,
  createCustomPreset,
  createDefaultPromptStudioSettings,
  deleteCustomPreset,
  MAX_CUSTOM_PROMPT_PRESETS,
  resetActionOverride,
  resetAllPromptOverrides,
  sanitizePromptStudioSettings,
  setActionOverride,
} from "./promptStudioSettings";

describe("promptStudioSettings (ST-01..ST-07)", () => {
  it("ST-01: sanitizePromptStudioSettings drops unknown action keys, strips invalid contextNodes, and repairs activePresetId", () => {
    const raw = {
      version: 1,
      activePresetId: "missing-custom-id",
      overrides: {
        "write:auto": {
          directive: "Custom directive",
          contextNodes: ["preceding_prose", "bogus_node", "preceding_prose"],
        },
        "unknown:action": {
          directive: "Should be dropped",
        },
      },
      customPresets: [],
    };

    const sanitized = sanitizePromptStudioSettings(raw);
    expect(sanitized.activePresetId).toBeNull();
    expect(sanitized.overrides["write:auto"]).toEqual({
      directive: "Custom directive",
      contextNodes: ["preceding_prose"],
    });
    expect(Object.prototype.hasOwnProperty.call(sanitized.overrides, "unknown:action")).toBe(false);
  });

  it("ST-02: setActionOverride removes the entry when directive and contextNodes both match defaults", () => {
    const base = createDefaultPromptStudioSettings();
    const withCustom = setActionOverride(base, "write:auto", {
      directive: "Write with extra suspense.",
    });
    expect(withCustom.overrides["write:auto"]?.directive).toBe("Write with extra suspense.");

    const reverted = setActionOverride(withCustom, "write:auto", {
      directive: DEFAULT_PROMPT_DIRECTIVES["write:auto"],
      contextNodes: [...getDefaultContextNodes("write:auto")],
    });
    expect(reverted.overrides["write:auto"]).toBeUndefined();
  });

  it("ST-03: resetActionOverride removes only the target key and preserves other overrides", () => {
    let state = createDefaultPromptStudioSettings();
    state = setActionOverride(state, "write:auto", { directive: "Custom Auto" });
    state = setActionOverride(state, "write:guided", { directive: "Custom Guided" });

    const afterSingleReset = resetActionOverride(state, "write:auto");
    expect(afterSingleReset.overrides["write:auto"]).toBeUndefined();
    expect(afterSingleReset.overrides["write:guided"]?.directive).toBe("Custom Guided");
  });

  it("ST-04: resetAllPromptOverrides clears all overrides and sets activePresetId=null while keeping customPresets", () => {
    let state = createDefaultPromptStudioSettings();
    state = setActionOverride(state, "write:auto", { directive: "Custom Auto" });
    const created = createCustomPreset(state, "My Preset", 1000, "preset-1");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const afterResetAll = resetAllPromptOverrides(created.settings);
    expect(afterResetAll.overrides).toEqual({});
    expect(afterResetAll.activePresetId).toBeNull();
    expect(afterResetAll.customPresets).toHaveLength(1);
  });

  it("ST-05 & ST-06: createCustomPreset snapshots overrides, enforces 80-char name & 20-preset cap, and deleteCustomPreset clears activePresetId", () => {
    let state = createDefaultPromptStudioSettings();
    state = setActionOverride(state, "write:auto", { directive: "Snapshot Directive" });

    const emptyRes = createCustomPreset(state, "   ");
    expect(emptyRes).toEqual({ ok: false, code: "EMPTY_NAME" });

    const longName = "N".repeat(120);
    const firstRes = createCustomPreset(state, longName, 1000, "preset-0");
    expect(firstRes.ok).toBe(true);
    if (!firstRes.ok) return;
    state = firstRes.settings;
    expect(state.customPresets).toHaveLength(1);
    expect(state.customPresets[0].name).toHaveLength(80);
    expect(state.activePresetId).toBe("preset-0");

    // Duplicate name rejected
    const dupRes = createCustomPreset(state, longName, 1001, "preset-dup");
    expect(dupRes).toEqual({ ok: false, code: "DUPLICATE_NAME" });

    // Fill up to MAX_CUSTOM_PROMPT_PRESETS (20)
    for (let i = 1; i < MAX_CUSTOM_PROMPT_PRESETS; i++) {
      const r = createCustomPreset(state, `Preset ${i}`, 1000 + i, `preset-${i}`);
      expect(r.ok).toBe(true);
      if (r.ok) state = r.settings;
    }
    expect(state.customPresets).toHaveLength(MAX_CUSTOM_PROMPT_PRESETS);
    expect(createCustomPreset(state, "Preset 21", 2000, "preset-21")).toEqual({
      ok: false,
      code: "LIMIT_REACHED",
    });

    // Delete active preset -> activePresetId resets to null
    const activeId = state.activePresetId!;
    const afterDelete = deleteCustomPreset(state, activeId);
    expect(afterDelete.customPresets).toHaveLength(MAX_CUSTOM_PROMPT_PRESETS - 1);
    expect(afterDelete.activePresetId).toBeNull();

    // Apply earlier custom preset
    const applied = applyPreset(afterDelete, "preset-0");
    expect(applied.activePresetId).toBe("preset-0");
    expect(applied.overrides["write:auto"]?.directive).toBe("Snapshot Directive");
  });

  it("ST-07: buildStreamPromptOverridePayload returns {} on default and returns overridden fields when customized", () => {
    const base = createDefaultPromptStudioSettings();
    expect(buildStreamPromptOverridePayload("write:auto", base)).toEqual({});

    const customized = setActionOverride(base, "write:auto", {
      directive: "Custom Auto Directive",
      contextNodes: ["style", "preceding_prose"],
    });
    expect(buildStreamPromptOverridePayload("write:auto", customized)).toEqual({
      promptDirectiveOverride: "Custom Auto Directive",
      contextNodes: ["style", "preceding_prose"],
    });
  });
});
