// src/app/features/chat/components/hooks/useThinkingLevel.test.ts
import { describe, it, expect } from "vitest";
import { getLowerThinkingLevel, type ThinkingLevel } from "./useThinkingLevel";

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
