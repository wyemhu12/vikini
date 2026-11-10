// src/app/features/chat/components/thinkingOptions.test.ts
import { describe, it, expect, vi } from "vitest";
import { MODEL_IDS } from "@/lib/utils/constants";
import { getThinkingOptions } from "./thinkingOptions";
import { getAvailableThinkingLevels } from "./hooks/useThinkingLevel";

const DICT: Record<string, string> = {
  thinkingOff: "Tắt",
  thinkingLevelMinimal: "Tối thiểu",
  thinkingLevelLow: "Nhanh",
  thinkingLevelMedium: "Vừa",
  thinkingLevelHigh: "Sâu",
  thinkingBudgetHint: "≤ {n} tokens",
  webSearchOff: "TẮT",
};

const makeT = () => vi.fn((key: string) => DICT[key] ?? key);

const values = (model: string) => getThinkingOptions(model, makeT()).map((o) => o.value);

describe("getThinkingOptions (TC-03)", () => {
  it("returns the hand-written level list for each model family", () => {
    expect(values("gemini-3-flash-preview")).toEqual(["off", "minimal", "low", "medium", "high"]);
    expect(values("gemini-3.8-flash")).toEqual(["off", "low", "medium", "high"]);
    expect(values("claude-sonnet-4.5")).toEqual(["off", "high"]);
    expect(values("deepseek-v4-flash")).toEqual(["off", "low", "high"]);
    expect(values("z-ai/glm-5.2")).toEqual(["off", "high"]);
    expect(values("gemini-4-argon")).toEqual(["low", "medium", "high"]);
    expect(values(MODEL_IDS.STRATA_LOCAL)).toEqual(["off", "low", "medium", "high"]);
  });

  it("stays in sync with getAvailableThinkingLevels", () => {
    for (const model of [
      "gemini-3-flash-preview",
      "gemini-3.1-pro-preview",
      "claude-sonnet-4.5",
      "deepseek-v4-flash",
      "gemini-4-argon",
      MODEL_IDS.STRATA_LOCAL,
    ]) {
      expect(values(model)).toEqual(getAvailableThinkingLevels(model));
    }
  });

  it("labels levels in sentence case and only adds budget hints for local models", () => {
    const gemini = getThinkingOptions("gemini-3.8-flash", makeT());
    expect(gemini.find((o) => o.value === "medium")?.label).toBe("Vừa");
    expect(gemini.every((o) => o.hint === undefined)).toBe(true);

    const local = getThinkingOptions(MODEL_IDS.STRATA_LOCAL, makeT());
    expect(local.find((o) => o.value === "medium")?.hint).toContain("8K");
    expect(local.find((o) => o.value === "off")?.hint).toBeUndefined();
  });
});

describe("getThinkingOptions off label (TC-04)", () => {
  it("uses thinkingOff and never the web-search OFF key", () => {
    for (const model of ["gemini-3.8-flash", "claude-sonnet-4.5", "deepseek-v4-flash"]) {
      const t = makeT();
      const off = getThinkingOptions(model, t).find((o) => o.value === "off");
      expect(off?.label).toBe("Tắt");
      expect(t).not.toHaveBeenCalledWith("webSearchOff");
    }
  });
});
