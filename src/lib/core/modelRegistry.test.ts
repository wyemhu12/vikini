import { describe, it, expect } from "vitest";
import { MODEL_IDS } from "@/lib/utils/constants";
import { en } from "@/lib/utils/translations/en";
import { vi } from "@/lib/utils/translations/vi";
import * as registry from "./modelRegistry";
import {
  DEFAULT_MODEL,
  MODEL_ALIASES,
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
    it("TC-REG-07: returns true for Gemini 3+ models (including legacy 2.5 aliases) and false for non-Gemini", () => {
      expect(modelSupportsThinking("gemini-3.5-flash-lite")).toBe(true);
      expect(modelSupportsThinking("gemini-3.8-flash")).toBe(true);
      expect(modelSupportsThinking("gemini-2.5-flash")).toBe(true);
      expect(modelSupportsThinking("gemini-2.5-pro")).toBe(true);
      expect(modelSupportsThinking("gemini-3-flash-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-pro-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-3.1-flash-lite-preview")).toBe(true);
      expect(modelSupportsThinking("gemini-4-argon")).toBe(true);

      expect(modelSupportsThinking("claude-sonnet-4.5")).toBe(false);
      expect(modelSupportsThinking("deepseek-v4-flash")).toBe(false);
      expect(modelSupportsThinking("x-ai/grok-4.3")).toBe(false);
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
      expect(getSupportedGeminiThinkingLevels("gemini-3.5-flash-lite")).toEqual([
        "minimal",
        "low",
        "medium",
        "high",
      ]);
    });

    it("returns low, medium, high for legacy Gemini 3.1 Pro alias and Gemini 3.8 Flash", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-3.1-pro-preview")).toEqual([
        "low",
        "medium",
        "high",
      ]);
      expect(getSupportedGeminiThinkingLevels("gemini-3.8-flash")).toEqual([
        "low",
        "medium",
        "high",
      ]);
    });

    it("returns low, medium, high for Gemini 4 Argon", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-4-argon")).toEqual(["low", "medium", "high"]);
    });

    it("returns target thinking levels for legacy Gemini 2.5 aliases", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-2.5-flash")).toEqual([
        "minimal",
        "low",
        "medium",
        "high",
      ]);
      expect(getSupportedGeminiThinkingLevels("gemini-2.5-pro")).toEqual(["low", "medium", "high"]);
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
    it("TC-REG-04: clamps minimal to low on models without minimal support (including gemini-3.8-flash and gemini-2.5-pro)", () => {
      expect(clampGeminiThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
      expect(clampGeminiThinkingLevel("gemini-3.8-flash", "minimal")).toBe("low");
      expect(clampGeminiThinkingLevel("gemini-3.8-flash", "high")).toBe("high");
      expect(clampGeminiThinkingLevel("gemini-2.5-pro", "minimal")).toBe("low");
      expect(clampGeminiThinkingLevel("gemini-2.5-flash", "minimal")).toBe("minimal");
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
      expect(clampGeminiThinkingLevel("claude-sonnet-4.5", "high")).toBe("low");
    });
  });

  describe("normalizeModelForApi", () => {
    it("maps model aliases to canonical IDs", () => {
      expect(normalizeModelForApi("gemini-3-pro-preview")).toBe("gemini-3.8-flash");
      expect(normalizeModelForApi("gemini-2.5-flash-preview")).toBe(DEFAULT_MODEL);
      expect(normalizeModelForApi("gemini-4-argon")).toBe(MODEL_IDS.GEMINI_4_ARGON);
      expect(normalizeModelForApi("gemini-4-argon-preview")).toBe(MODEL_IDS.GEMINI_4_ARGON);
      expect(normalizeModelForApi("z-ai/glm-5.2-20260616")).toBe(MODEL_IDS.GLM_52);
      expect(normalizeModelForApi("glm-5.2")).toBe(MODEL_IDS.GLM_52);
      expect(normalizeModelForApi(MODEL_IDS.GLM_52)).toBe(MODEL_IDS.GLM_52);
    });

    it("falls back to DEFAULT_MODEL for unknown models", () => {
      expect(normalizeModelForApi("unknown-unsupported-model")).toBe(DEFAULT_MODEL);
    });

    it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
      "TC-REG-09: does not match inherited Object.prototype key %s in MODEL_ALIASES",
      (key) => {
        const normalized = normalizeModelForApi(key);
        expect(normalized).toBe(DEFAULT_MODEL);
        expect(typeof normalized).toBe("string");
        expect(coerceStoredModel(key)).toBe(DEFAULT_MODEL);
      }
    );
  });

  describe("Gemini 2.5 Deprecation Migration -> Gemini 3.5 Flash-Lite & Gemini 3.8 Flash (TC-REG-01..08)", () => {
    it("TC-REG-01: sets DEFAULT_MODEL and SELECTABLE_MODELS[0].id to gemini-3.5-flash-lite", () => {
      expect(DEFAULT_MODEL).toBe("gemini-3.5-flash-lite");
      expect(SELECTABLE_MODELS[0]?.id).toBe("gemini-3.5-flash-lite");
    });

    it("TC-REG-02: registers gemini-3.5-flash-lite with exact 1M/64K specs and full thinking levels", () => {
      const entry = SELECTABLE_MODELS.find((m) => m.id === "gemini-3.5-flash-lite");
      expect(entry).toEqual({
        id: "gemini-3.5-flash-lite",
        descKey: "modelDescFlashLite35",
        name: "Gemini 3.5 Flash-Lite",
        tokenLimit: 1048576,
        contextWindow: 1048576,
        maxOutputTokens: 65536,
        category: "low-latency",
        supportedThinkingLevels: ["minimal", "low", "medium", "high"],
        providerId: "gemini",
      });
    });

    it("TC-REG-03: registers gemini-3.8-flash in reasoning category with low/medium/high (no minimal)", () => {
      const entry = SELECTABLE_MODELS.find((m) => m.id === "gemini-3.8-flash");
      expect(entry).toEqual({
        id: "gemini-3.8-flash",
        descKey: "modelDescFlash38",
        name: "Gemini 3.8 Flash",
        tokenLimit: 1048576,
        contextWindow: 1048576,
        maxOutputTokens: 65536,
        category: "reasoning",
        supportedThinkingLevels: ["low", "medium", "high"],
        providerId: "gemini",
      });
      const levels = getSupportedGeminiThinkingLevels("gemini-3.8-flash");
      expect(levels).toEqual(["low", "medium", "high"]);
      expect(levels.includes("minimal")).toBe(false);
    });

    it.each([
      ["gemini-2.5-flash", "gemini-3.5-flash-lite"],
      ["gemini-2.5-pro", "gemini-3.8-flash"],
    ] as const)(
      "TC-REG-05: maps legacy %s to %s in MODEL_ALIASES, normalizeModelForApi, and coerceStoredModel while removing from selectable set",
      (legacyId, targetId) => {
        expect(MODEL_ALIASES[legacyId]).toBe(targetId);
        expect(normalizeModelForApi(legacyId)).toBe(targetId);
        expect(coerceStoredModel(legacyId)).toBe(targetId);
        expect(isSelectableModelId(legacyId)).toBe(false);
      }
    );

    it("TC-REG-06: removes all gemini-2.5-* entries from SELECTABLE_MODELS", () => {
      const gemini25Entries = SELECTABLE_MODELS.filter((m) => m.id.startsWith("gemini-2.5"));
      expect(gemini25Entries).toHaveLength(0);
      expect(normalizeModelForApi("gemini-2.5-flash-preview")).toBe(DEFAULT_MODEL);
    });

    it("TC-REG-08: wires descKey translations for all SELECTABLE_MODELS and removes orphaned modelDescFlash25/modelDescPro25", () => {
      for (const model of SELECTABLE_MODELS) {
        expect(Object.hasOwn(en, model.descKey)).toBe(true);
        expect(Object.hasOwn(vi, model.descKey)).toBe(true);
      }
      expect(Object.hasOwn(en, "modelDescFlash25")).toBe(false);
      expect(Object.hasOwn(vi, "modelDescFlash25")).toBe(false);
      expect(Object.hasOwn(en, "modelDescPro25")).toBe(false);
      expect(Object.hasOwn(vi, "modelDescPro25")).toBe(false);
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

  describe("OpenRouter Free Model Removal (TC-ORF)", () => {
    const REMOVED_OPENROUTER_FREE_IDS = [
      "meta-llama/llama-4-maverick:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "mistral/mistral-small-3.1-24b-instruct:free",
    ] as const;

    const REMOVED_DESC_KEYS = [
      "modelDescLlama4Maverick",
      "modelDescLlama33Instruct",
      "modelDescGemma3",
      "modelDescMistralSmall",
    ] as const;

    it.each(REMOVED_OPENROUTER_FREE_IDS)(
      "TC-ORF-01 & TC-ORF-02: %s is no longer selectable and falls back to DEFAULT_MODEL",
      (id) => {
        expect(SELECTABLE_MODELS.some((m) => m.id === id)).toBe(false);
        expect(isSelectableModelId(id)).toBe(false);
        expect(normalizeModelForApi(id)).toBe(DEFAULT_MODEL);
        expect(coerceStoredModel(id)).toBe(DEFAULT_MODEL);
        expect(getModelTokenLimit(id)).toBe(getModelTokenLimit(DEFAULT_MODEL));
      }
    );

    it("TC-ORF-03 & TC-ORF-04: retains openrouter-free provider label with an empty model list", () => {
      const openRouterFreeModels = SELECTABLE_MODELS.filter(
        (m) => m.providerId === "openrouter-free"
      );
      expect(openRouterFreeModels).toHaveLength(0);
      expect(PROVIDER_LABELS["openrouter-free"]).toBe("OpenRouter (Free)");
    });

    it("TC-ORF-05: removes all :free models from SELECTABLE_MODELS", () => {
      const freeSuffixModels = SELECTABLE_MODELS.filter((m) => m.id.endsWith(":free"));
      expect(freeSuffixModels).toHaveLength(0);
    });

    it.each(REMOVED_DESC_KEYS)(
      "TC-ORF-06: removes orphaned translation key %s from both en and vi",
      (key) => {
        expect(Object.hasOwn(en, key)).toBe(false);
        expect(Object.hasOwn(vi, key)).toBe(false);
      }
    );

    it("TC-ORF-07: preserves valid en and vi translation keys for all remaining SELECTABLE_MODELS", () => {
      for (const model of SELECTABLE_MODELS) {
        expect(Object.hasOwn(en, model.descKey)).toBe(true);
        expect(Object.hasOwn(vi, model.descKey)).toBe(true);
      }
    });

    it("TC-ORF-08: preserves Groq llama-3.3-70b-versatile model without regression", () => {
      expect(isSelectableModelId("llama-3.3-70b-versatile")).toBe(true);
      expect(normalizeModelForApi("llama-3.3-70b-versatile")).toBe("llama-3.3-70b-versatile");
      const groqModel = SELECTABLE_MODELS.find((m) => m.id === "llama-3.3-70b-versatile");
      expect(groqModel?.providerId).toBe("groq");
    });
  });

  describe("Gemini 3.1 Deprecation Migration (TC-G31-01..07)", () => {
    it("TC-G31-01: removes all gemini-3.1* models from SELECTABLE_MODELS", () => {
      const remaining31 = SELECTABLE_MODELS.filter((m) => m.id.startsWith("gemini-3.1"));
      expect(remaining31).toHaveLength(0);
    });

    it.each([
      ["gemini-3.1-pro-preview", "gemini-3.8-flash"],
      ["gemini-3.1-flash-lite-preview", "gemini-3.5-flash-lite"],
    ] as const)(
      "TC-G31-02: maps %s → %s across MODEL_ALIASES, normalizeModelForApi, coerceStoredModel, and marks non-selectable",
      (legacyId, target) => {
        expect(MODEL_ALIASES[legacyId]).toBe(target);
        expect(normalizeModelForApi(legacyId)).toBe(target);
        expect(coerceStoredModel(legacyId)).toBe(target);
        expect(isSelectableModelId(legacyId)).toBe(false);
      }
    );

    it.each(["gemini-3.1-pro", "gemini-3-pro", "gemini-3-pro-preview"])(
      "TC-G31-03: maps %s directly to gemini-3.8-flash",
      (aliasId) => {
        expect(normalizeModelForApi(aliasId)).toBe("gemini-3.8-flash");
      }
    );

    it("TC-G31-04: maps gemini-3.1-flash-lite directly to gemini-3.5-flash-lite", () => {
      expect(normalizeModelForApi("gemini-3.1-flash-lite")).toBe("gemini-3.5-flash-lite");
    });

    it.each(Object.entries(MODEL_ALIASES))(
      "TC-G31-05: alias %s → %s resolves to a live canonical ID",
      (_alias, target) => {
        expect(normalizeModelForApi(target)).toBe(target);
        expect(target.startsWith("gemini-3.1")).toBe(false);
      }
    );

    it.each([
      "modelDescPro31",
      "modelDescFlashLite31",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite-preview",
    ])("TC-G31-06: removes deprecated translation key %s from both en and vi", (key) => {
      expect(Object.hasOwn(en, key)).toBe(false);
      expect(Object.hasOwn(vi, key)).toBe(false);
    });

    it("TC-G31-07: preserves thinking level behavior for legacy Gemini 3.1 IDs via aliases", () => {
      expect(getSupportedGeminiThinkingLevels("gemini-3.1-pro-preview")).toEqual([
        "low",
        "medium",
        "high",
      ]);
      expect(clampGeminiThinkingLevel("gemini-3.1-pro-preview", "minimal")).toBe("low");
      expect(getSupportedGeminiThinkingLevels("gemini-3.1-flash-lite-preview")).toEqual([
        "minimal",
        "low",
        "medium",
        "high",
      ]);
    });
  });
});
