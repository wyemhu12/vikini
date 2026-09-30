// src/lib/utils/tokenEstimate.test.ts
import { describe, it, expect } from "vitest";
import { estimateTokens, estimateCharBudget } from "./tokenEstimate";

describe("estimateTokens", () => {
  it("returns 0 for null, undefined, or empty string", () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates English ASCII text with ~4 chars per token plus 10% margin", () => {
    const text = "Hello world, this is a test sentence."; // 37 chars
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(20);
  });

  it("calibrates Vietnamese text with higher token density (~2.0 chars/token)", () => {
    const viText = "Xin chào Việt Nam, đây là hệ thống trí tuệ nhân tạo Vikini.";
    const enText = "Hello Vietnam, this is the artificial intelligence Vikini system.";
    const viTokens = estimateTokens(viText);
    const enTokens = estimateTokens(enText);
    expect(viTokens).toBeGreaterThan(0);
    expect(enTokens).toBeGreaterThan(0);
    // Vietnamese text should produce relatively more tokens per char than pure ASCII
    expect(viTokens / viText.length).toBeGreaterThan(enTokens / enText.length);
  });

  it("handles CJK characters properly", () => {
    const cjk = "こんにちは世界";
    expect(estimateTokens(cjk)).toBeGreaterThan(0);
  });
});

describe("estimateCharBudget", () => {
  it("returns 0 for non-positive tokens", () => {
    expect(estimateCharBudget(0)).toBe(0);
    expect(estimateCharBudget(-10)).toBe(0);
  });

  it("calculates character budget using default 1.8 ratio", () => {
    expect(estimateCharBudget(1000)).toBe(1800);
  });

  it("allows custom ratio override", () => {
    expect(estimateCharBudget(1000, 2.5)).toBe(2500);
  });
});
