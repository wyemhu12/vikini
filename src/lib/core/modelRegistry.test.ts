import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL,
  modelSupportsThinking,
  getSupportedGeminiThinkingLevels,
  clampGeminiThinkingLevel,
  normalizeModelForApi,
} from "./modelRegistry";

describe("modelRegistry - Gemini Thinking Level & Model Normalization", () => {
  describe("modelSupportsThinking", () => {
    it("returns true for Gemini 3+ models and false for Gemini 2.5 / non-Gemini", () => {
      expect(modelSupportsThinking("gemini-3-flash-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-pro-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-flash-lite-preview")).toBe(true);

      expect(modelSupportsThinking("gemini-2.5-flash")).toBe(false);
      expect(modelSupportsThinking("gemini-2.5-pro")).toBe(false);
      expect(modelSupportsThinking("claude-sonnet-4.5")).toBe(false);
      expect(modelSupportsThinking("deepseek-v4-flash")).toBe(false);
    });
  });

  describe("getSupportedGeminiThinkingLevels", () => {
    it("returns full levels for Gemini 3 Flash and Flash-Lite", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-3-flash-preview")).toEqual([
        "minimal",
        "low",
        "medium",
        "high",
      ]);
      expect(getSupportedGeminiThinkingLevels("gemini-3.1-flash-lite-preview")).toEqual([
        "minimal",
        "low",
        "medium",
        "high",
      ]);
    });

    it("returns low, medium, high for Gemini 3.1 Pro", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-3.1-pro-preview")).toEqual([
        "low",
        "medium",
        "high",
      ]);
    });

    it("returns empty array for Gemini 2.5 models", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-2.5-flash")).toEqual([]);
      expect(getSupportedGeminiThinkingLevels("gemini-2.5-pro")).toEqual([]);
    });

    it("returns fallback levels for unlisted Gemini 3 models", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-3-pro-image")).toEqual([
        "low",
        "medium",
        "high",
      ]);
    });
  });

  describe("clampGeminiThinkingLevel", () => {
    it("clamps minimal to low on models without minimal support", () => {
      expect(clampGeminiThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
    });

    it("preserves valid supported levels", () => {
      expect(clampGeminiThinkingLevel("gemini-3-flash-preview", "minimal")).toBe("minimal");
      expect(clampGeminiThinkingLevel("gemini-3-flash-preview", "high")).toBe("high");
      expect(clampGeminiThinkingLevel("gemini-3.1-pro-preview", "medium")).toBe("medium");
    });

    it("returns low when model has no supported thinking levels", () => {
      expect(clampGeminiThinkingLevel("gemini-2.5-flash", "high")).toBe("low");
    });
  });

  describe("normalizeModelForApi", () => {
    it("maps model aliases to canonical IDs", () => {
      expect(normalizeModelForApi("gemini-3-pro-preview")).toBe("gemini-3.1-pro-preview");
      expect(normalizeModelForApi("gemini-2.5-flash-preview")).toBe("gemini-2.5-flash");
    });

    it("falls back to DEFAULT_MODEL for unknown models", () => {
      expect(normalizeModelForApi("unknown-unsupported-model")).toBe(DEFAULT_MODEL);
    });
  });
});
