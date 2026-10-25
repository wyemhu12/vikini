import { describe, it, expect } from "vitest";
import { MODEL_IDS } from "@/lib/utils/constants";
import * as registry from "./modelRegistry";
import {
  DEFAULT_MODEL,
  isGemini4Model,
  modelSupportsThinking,
  getSupportedGeminiThinkingLevels,
  clampGeminiThinkingLevel,
  normalizeModelForApi,
  isSelectableModelId,
  coerceStoredModel,
  isGLMModel,
  isOpenRouterReasoningModel,
  getModelTokenLimit,
  getModelMaxOutputTokens,
  GLM_MAX_OUTPUT_TOKENS,
  isStrataLocalModel,
  modelSupportsWebSearch,
  SELECTABLE_MODELS,
  PROVIDER_LABELS,
} from "./modelRegistry";

describe("modelRegistry - Gemini Thinking Level & Model Normalization", () => {
  describe("modelSupportsThinking", () => {
    it("returns true for Gemini 3+ models and false for Gemini 2.5 / non-Gemini", () => {
      expect(modelSupportsThinking("gemini-3-flash-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-pro-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-flash-lite-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-4-argon")).toBe(true);

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

    it("returns low, medium, high for Gemini 4 Argon", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-4-argon")).toEqual(["low", "medium", "high"]);
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
      expect(clampGeminiThinkingLevel("gemini-4-argon", "minimal")).toBe("low");
      expect(clampGeminiThinkingLevel("gemini-4-argon", "off")).toBe("low");
    });

    it("preserves valid supported levels", () => {
      expect(clampGeminiThinkingLevel("gemini-3-flash-preview", "minimal")).toBe("minimal");
      expect(clampGeminiThinkingLevel("gemini-3-flash-preview", "high")).toBe("high");
      expect(clampGeminiThinkingLevel("gemini-3.1-pro-preview", "medium")).toBe("medium");
      expect(clampGeminiThinkingLevel("gemini-4-argon", "medium")).toBe("medium");
      expect(clampGeminiThinkingLevel("gemini-4-argon", "high")).toBe("high");
    });

    it("returns low when model has no supported thinking levels", () => {
      expect(clampGeminiThinkingLevel("gemini-2.5-flash", "high")).toBe("low");
    });
  });

  describe("normalizeModelForApi", () => {
    it("maps model aliases to canonical IDs", () => {
      expect(normalizeModelForApi("gemini-3-pro-preview")).toBe("gemini-3.1-pro-preview");
      expect(normalizeModelForApi("gemini-2.5-flash-preview")).toBe("gemini-2.5-flash");
      expect(normalizeModelForApi("gemini-4-argon")).toBe(MODEL_IDS.GEMINI_4_ARGON);
      expect(normalizeModelForApi("gemini-4-argon-preview")).toBe(MODEL_IDS.GEMINI_4_ARGON);
      expect(normalizeModelForApi("z-ai/glm-5.2-20260616")).toBe(MODEL_IDS.GLM_52);
      expect(normalizeModelForApi("glm-5.2")).toBe(MODEL_IDS.GLM_52);
      expect(normalizeModelForApi(MODEL_IDS.GLM_52)).toBe(MODEL_IDS.GLM_52);
    });

    it("falls back to DEFAULT_MODEL for unknown models", () => {
      expect(normalizeModelForApi("unknown-unsupported-model")).toBe(DEFAULT_MODEL);
    });
  });

  describe("Gemini 4 Argon Specifications", () => {
    it("correctly identifies Gemini 4 models via isGemini4Model", () => {
      expect(isGemini4Model("gemini-4-argon")).toBe(true);
      expect(isGemini4Model("gemini-4-argon-preview")).toBe(true);
      expect(isGemini4Model("gemini-3.1-pro-preview")).toBe(false);
      expect(isGemini4Model("gemini-2.5-flash")).toBe(false);
    });

    it("returns correct 1M unified tokenLimit and 64K maxOutputTokens for Gemini 4 Argon", () => {
      expect(getModelTokenLimit("gemini-4-argon")).toBe(1048576);
      expect(getModelMaxOutputTokens("gemini-4-argon")).toBe(65536);
    });
  });

  describe("GLM 5.2 & Reasoning Registry Specifications", () => {
    it("correctly identifies GLM models using isGLMModel SSOT", () => {
      expect(isGLMModel(MODEL_IDS.GLM_52)).toBe(true);
      expect(isGLMModel("z-ai/glm-5.2-20260616")).toBe(true);
      expect(isGLMModel("glm-5.2")).toBe(true);
      expect(isGLMModel("claude-sonnet-4.5")).toBe(false);
      expect(isGLMModel("x-ai/grok-4.3")).toBe(false);
    });

    it("correctly registers GLM 5.2 in isOpenRouterReasoningModel", () => {
      expect(isOpenRouterReasoningModel(MODEL_IDS.GLM_52)).toBe(true);
      expect(isOpenRouterReasoningModel("x-ai/grok-4.3")).toBe(true);
      expect(isOpenRouterReasoningModel("deepseek-v4-flash")).toBe(false);
    });

    it("returns correct tokenLimit and safe maxOutputTokens for GLM 5.2", () => {
      expect(getModelTokenLimit(MODEL_IDS.GLM_52)).toBe(1048576);
      expect(getModelMaxOutputTokens(MODEL_IDS.GLM_52)).toBe(GLM_MAX_OUTPUT_TOKENS);
      expect(GLM_MAX_OUTPUT_TOKENS).toBe(65536);
    });
  });

  describe("Novelcrafter Studio Pseudo-Model Registration (TC-01)", () => {
    it("preserves MODEL_IDS.NOVELCRAFTER across isSelectableModelId, normalizeModelForApi, and coerceStoredModel", () => {
      expect(MODEL_IDS.NOVELCRAFTER).toBe("vikini-novelcrafter");
      expect(isSelectableModelId(MODEL_IDS.NOVELCRAFTER)).toBe(true);
      expect(normalizeModelForApi(MODEL_IDS.NOVELCRAFTER)).toBe(MODEL_IDS.NOVELCRAFTER);
      expect(coerceStoredModel(MODEL_IDS.NOVELCRAFTER)).toBe(MODEL_IDS.NOVELCRAFTER);
    });
  });

  describe("Strata Local Model Registration (TC-37)", () => {
    it("identifies strata-local via isStrataLocalModel, disables web search, and registers under Local Models", () => {
      expect(isStrataLocalModel("strata-local")).toBe(true);
      expect(isStrataLocalModel("gemini-3-flash-preview")).toBe(false);
      expect(modelSupportsWebSearch("strata-local")).toBe(false);
      expect(isSelectableModelId("strata-local")).toBe(true);
      expect(normalizeModelForApi("strata-local")).toBe("strata-local");
      expect(PROVIDER_LABELS.local).toBe("Local Models");

      const entry = SELECTABLE_MODELS.find((m) => m.id === "strata-local");
      expect(entry).toBeDefined();
      expect(entry?.name).toBe("Orcarouter-qwen3.8-flash-next-uncensored-iq3");
      expect(entry?.providerId).toBe("local");
      expect(entry?.category).toBe("local");
      expect(entry?.tokenLimit).toBe(32768);
      expect(entry?.maxOutputTokens).toBe(16384);
    });
  });

  describe("Legacy Capability Helper Removal Negative Probe (T7)", () => {
    it("does not export removed capability helper", () => {
      const helperKey = ["modelSupports", "Deep", "Research"].join("");
      expect(helperKey in registry).toBe(false);
    });
  });
});
