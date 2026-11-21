import { describe, it, expect } from "vitest";
import * as useThinkingLevelModule from "./useThinkingLevel";
import {
  getLowerThinkingLevel,
  getAvailableThinkingLevels,
  getEffectiveThinkingLevel,
  modelSupportsThinkingUI,
  isStrataLocalThinkingModel,
  type ThinkingLevel,
} from "./useThinkingLevel";

describe("getLowerThinkingLevel", () => {
  it("degrades high to low when only [off, low, high] are available", () => {
    const available: ThinkingLevel[] = ["off", "low", "high"];
    expect(getLowerThinkingLevel("high", available)).toBe("low");
  });

  it("degrades high to medium when [off, low, medium, high] are available", () => {
    const available: ThinkingLevel[] = ["off", "low", "medium", "high"];
    expect(getLowerThinkingLevel("high", available)).toBe("medium");
  });

  it("returns null when current is already the lowest active level (low)", () => {
    const available: ThinkingLevel[] = ["off", "low", "high"];
    expect(getLowerThinkingLevel("low", available)).toBeNull();
  });

  it("handles foreign current state (medium when model only supports off/low/high)", () => {
    const available: ThinkingLevel[] = ["off", "low", "high"];
    expect(getLowerThinkingLevel("medium", available)).toBe("low");
  });

  it("returns null when current is off", () => {
    const available: ThinkingLevel[] = ["off", "low", "high"];
    expect(getLowerThinkingLevel("off", available)).toBeNull();
  });

  it("returns null for models with only on/off (e.g. Claude: [off, high])", () => {
    const available: ThinkingLevel[] = ["off", "high"];
    expect(getLowerThinkingLevel("high", available)).toBeNull();
  });

  it("degrades step-by-step through full spectrum (Gemini 3 Flash)", () => {
    const available: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];
    expect(getLowerThinkingLevel("high", available)).toBe("medium");
    expect(getLowerThinkingLevel("medium", available)).toBe("low");
    expect(getLowerThinkingLevel("low", available)).toBe("minimal");
    expect(getLowerThinkingLevel("minimal", available)).toBeNull();
  });
});

describe("getAvailableThinkingLevels", () => {
  it("returns low, medium, high, xhigh (without off) for Gemini 4 Hydrogen, Gemini 4 Neon, and legacy Gemini 3/4 aliases", () => {
    expect(getAvailableThinkingLevels("gemini-4-hydrogen")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels("gemini-4-neon")).toEqual(["low", "medium", "high", "xhigh"]);
    expect(getAvailableThinkingLevels("gemini-3.8-flash")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels("gemini-3-flash-preview")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels("gemini-3.1-pro-preview")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(getAvailableThinkingLevels("gemini-4-argon")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
  });

  it("TC-UTL-02: returns full levels including off and minimal for Gemini 3.5 Flash-Lite", () => {
    expect(getAvailableThinkingLevels("gemini-3.5-flash-lite")).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
    expect(getAvailableThinkingLevels("gemini-2.5-flash")).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
  });

  it("returns off, high for Claude 5.5 Sonnet and Haiku", () => {
    expect(getAvailableThinkingLevels("claude-sonnet-5-5")).toEqual(["off", "high"]);
    expect(getAvailableThinkingLevels("claude-haiku-5-5")).toEqual(["off", "high"]);
  });

  it("returns off, low, high for DeepSeek V4", () => {
    expect(getAvailableThinkingLevels("deepseek/deepseek-v4.1-flash")).toEqual([
      "off",
      "low",
      "high",
    ]);
    expect(getAvailableThinkingLevels("deepseek/deepseek-v4-pro")).toEqual(["off", "low", "high"]);
  });

  it("returns off, high for GLM 5.2", () => {
    expect(getAvailableThinkingLevels("z-ai/glm-5.2")).toEqual(["off", "high"]);
  });
});

describe("getEffectiveThinkingLevel", () => {
  it("Claude 5.5 maps non-off levels to high and preserves off", () => {
    expect(getEffectiveThinkingLevel("claude-sonnet-5-5", "low")).toBe("high");
    expect(getEffectiveThinkingLevel("claude-sonnet-5-5", "xhigh")).toBe("high");
    expect(getEffectiveThinkingLevel("claude-haiku-5-5", "high")).toBe("high");
    expect(getEffectiveThinkingLevel("claude-sonnet-5-5", "off")).toBe("off");
  });

  it("legacy gemini-3.1-pro-preview alias clamps minimal to low", () => {
    expect(getEffectiveThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-3.1-pro-preview", "medium")).toBe("medium");
  });

  it("Gemini 4 Neon & Hydrogen clamp off/minimal to low and preserve medium/high/xhigh", () => {
    expect(getEffectiveThinkingLevel("gemini-4-neon", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-4-neon", "off")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-4-neon", "medium")).toBe("medium");
    expect(getEffectiveThinkingLevel("gemini-4-neon", "high")).toBe("high");
    expect(getEffectiveThinkingLevel("gemini-4-neon", "xhigh")).toBe("xhigh");
    expect(getEffectiveThinkingLevel("gemini-4-hydrogen", "xhigh")).toBe("xhigh");
  });

  it("Gemini 3.5 Flash-Lite preserves supported levels and clamps xhigh to high (TC-MC-03)", () => {
    expect(getEffectiveThinkingLevel("gemini-3.5-flash-lite", "minimal")).toBe("minimal");
    expect(getEffectiveThinkingLevel("gemini-3.5-flash-lite", "high")).toBe("high");
    expect(getEffectiveThinkingLevel("gemini-3.5-flash-lite", "xhigh")).toBe("high");
  });

  it("DeepSeek V4 maps minimal/low/medium to low and high/xhigh to high (TC-MC-03)", () => {
    expect(getEffectiveThinkingLevel("deepseek/deepseek-v4-pro", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek/deepseek-v4-pro", "low")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek/deepseek-v4-pro", "medium")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek/deepseek-v4-pro", "high")).toBe("high");
    expect(getEffectiveThinkingLevel("deepseek/deepseek-v4-pro", "xhigh")).toBe("high");
  });

  it("TC-UTL-03: clamps minimal to low on gemini-4-hydrogen / gemini-2.5-pro and preserves minimal on gemini-2.5-flash", () => {
    expect(getEffectiveThinkingLevel("gemini-4-hydrogen", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-2.5-pro", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-2.5-flash", "minimal")).toBe("minimal");
    expect(getEffectiveThinkingLevel("gemini-2.5-flash", "high")).toBe("high");
  });

  it("GLM 5.2 maps non-off levels to high and preserves off", () => {
    expect(getEffectiveThinkingLevel("z-ai/glm-5.2", "off")).toBe("off");
    expect(getEffectiveThinkingLevel("z-ai/glm-5.2", "low")).toBe("high");
    expect(getEffectiveThinkingLevel("z-ai/glm-5.2", "medium")).toBe("high");
    expect(getEffectiveThinkingLevel("z-ai/glm-5.2", "high")).toBe("high");
  });

  it("Non-thinking model returns off", () => {
    expect(getEffectiveThinkingLevel("claude-haiku-3.5", "high")).toBe("off");
    expect(getEffectiveThinkingLevel("openai/gpt-oss-120b", "low")).toBe("off");
  });
});

describe("modelSupportsThinkingUI", () => {
  it("returns true for GLM 5.2, Gemini 4 Neon/Hydrogen, Claude 5.5 Haiku, and false for Groq", () => {
    expect(modelSupportsThinkingUI("z-ai/glm-5.2")).toBe(true);
    expect(modelSupportsThinkingUI("gemini-4-neon")).toBe(true);
    expect(modelSupportsThinkingUI("gemini-4-hydrogen")).toBe(true);
    expect(modelSupportsThinkingUI("claude-haiku-5-5")).toBe(true);
    expect(modelSupportsThinkingUI("openai/gpt-oss-120b")).toBe(false);
  });

  it("supports strata-local with off/low/medium/high and clamps minimal -> low and xhigh -> high (TC-39, TC-MC-03)", () => {
    expect(isStrataLocalThinkingModel("strata-local")).toBe(true);
    expect(modelSupportsThinkingUI("strata-local")).toBe(true);
    expect(getAvailableThinkingLevels("strata-local")).toEqual(["off", "low", "medium", "high"]);
    expect(getEffectiveThinkingLevel("strata-local", "off")).toBe("off");
    expect(getEffectiveThinkingLevel("strata-local", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("strata-local", "low")).toBe("low");
    expect(getEffectiveThinkingLevel("strata-local", "medium")).toBe("medium");
    expect(getEffectiveThinkingLevel("strata-local", "high")).toBe("high");
    expect(getEffectiveThinkingLevel("strata-local", "xhigh")).toBe("high");
  });

  it("TC-UTL-04: supports legacy Gemini 2.5 aliases via modelSupportsThinkingUI and removes dead helpers isGemini25Model / isGemini3FlashModel", () => {
    expect(modelSupportsThinkingUI("gemini-2.5-pro")).toBe(true);
    expect(modelSupportsThinkingUI("gemini-2.5-flash")).toBe(true);
    expect(Object.hasOwn(useThinkingLevelModule, "isGemini25Model")).toBe(false);
    expect(Object.hasOwn(useThinkingLevelModule, "isGemini3FlashModel")).toBe(false);
  });
});
