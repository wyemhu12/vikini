import { describe, it, expect } from "vitest";
import {
  getLowerThinkingLevel,
  getAvailableThinkingLevels,
  getEffectiveThinkingLevel,
  modelSupportsThinkingUI,
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
  it("returns full levels for Gemini 3 Flash", () => {
    expect(getAvailableThinkingLevels("gemini-3-flash-preview")).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
    ]);
  });

  it("returns low, medium, high for Gemini 3.1 Pro", () => {
    expect(getAvailableThinkingLevels("gemini-3.1-pro-preview")).toEqual([
      "off",
      "low",
      "medium",
      "high",
    ]);
  });

  it("returns off, low, high for Gemini 2.5 Flash", () => {
    expect(getAvailableThinkingLevels("gemini-2.5-flash")).toEqual(["off", "low", "high"]);
  });

  it("returns off, high for Claude", () => {
    expect(getAvailableThinkingLevels("claude-sonnet-4.5")).toEqual(["off", "high"]);
  });

  it("returns off, low, high for DeepSeek V4", () => {
    expect(getAvailableThinkingLevels("deepseek-v4-flash")).toEqual(["off", "low", "high"]);
  });

  it("returns off, high for GLM 5.2", () => {
    expect(getAvailableThinkingLevels("z-ai/glm-5.2")).toEqual(["off", "high"]);
  });

  it("returns low, medium, high (without off) for Gemini 4 Argon", () => {
    expect(getAvailableThinkingLevels("gemini-4-argon")).toEqual(["low", "medium", "high"]);
  });
});

describe("getEffectiveThinkingLevel", () => {
  it("Claude maps non-off levels to high and preserves off", () => {
    expect(getEffectiveThinkingLevel("claude-sonnet-4.5", "low")).toBe("high");
    expect(getEffectiveThinkingLevel("claude-sonnet-4.5", "minimal")).toBe("high");
    expect(getEffectiveThinkingLevel("claude-sonnet-4.5", "off")).toBe("off");
  });

  it("Gemini 3.1 Pro clamps minimal to low", () => {
    expect(getEffectiveThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-3.1-pro-preview", "medium")).toBe("medium");
  });

  it("Gemini 4 Argon clamps off and minimal to low and preserves medium/high", () => {
    expect(getEffectiveThinkingLevel("gemini-4-argon", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-4-argon", "off")).toBe("low");
    expect(getEffectiveThinkingLevel("gemini-4-argon", "medium")).toBe("medium");
    expect(getEffectiveThinkingLevel("gemini-4-argon", "high")).toBe("high");
  });

  it("Gemini 3 Flash preserves supported levels", () => {
    expect(getEffectiveThinkingLevel("gemini-3-flash-preview", "minimal")).toBe("minimal");
    expect(getEffectiveThinkingLevel("gemini-3-flash-preview", "high")).toBe("high");
  });

  it("DeepSeek V4 maps minimal, low, medium to low and high to high", () => {
    expect(getEffectiveThinkingLevel("deepseek-v4-flash", "minimal")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek-v4-flash", "low")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek-v4-flash", "medium")).toBe("low");
    expect(getEffectiveThinkingLevel("deepseek-v4-flash", "high")).toBe("high");
  });

  it("Gemini 2.5 maps minimal to low and high to high", () => {
    expect(getEffectiveThinkingLevel("gemini-2.5-flash", "minimal")).toBe("low");
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
    expect(getEffectiveThinkingLevel("llama-3.3-70b-versatile", "low")).toBe("off");
  });
});

describe("modelSupportsThinkingUI", () => {
  it("returns true for GLM 5.2, Gemini 4 Argon, and other supported models", () => {
    expect(modelSupportsThinkingUI("z-ai/glm-5.2")).toBe(true);
    expect(modelSupportsThinkingUI("gemini-4-argon")).toBe(true);
    expect(modelSupportsThinkingUI("gemini-3-flash-preview")).toBe(true);
    expect(modelSupportsThinkingUI("llama-3.3-70b-versatile")).toBe(false);
  });
});
