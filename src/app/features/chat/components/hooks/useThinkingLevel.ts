// /app/features/chat/components/hooks/useThinkingLevel.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSupportedGeminiThinkingLevels,
  clampGeminiThinkingLevel,
  isGLMModel,
  isGemini4Model,
  isStrataLocalModel,
} from "@/lib/core/modelRegistry";

/**
 * Thinking levels supported by AI models.
 * - "off" (default): No thinking mode
 * - "low": Faster responses, less reasoning
 * - "medium": Balanced (Gemini Flash / Gemini 4 Argon)
 * - "high": Maximum reasoning depth
 * - "minimal": Near-zero thinking (Gemini Flash only)
 */
export type ThinkingLevel = "off" | "high" | "low" | "medium" | "minimal";

/**
 * Check if a model is a Gemini 3 or Gemini 4 model (supports thinkingLevel config)
 */
export function isGemini3Model(model: string): boolean {
  return model.includes("gemini-3") || model.includes("gemini-3.") || model.includes("gemini-4");
}

/**
 * Check if a model is a Gemini 2.5 model (supports thinkingBudget config)
 */
export function isGemini25Model(model: string): boolean {
  return model.includes("gemini-2.5");
}

/**
 * Check if a model is a Gemini 3 Flash variant (supports extended levels)
 */
export function isGemini3FlashModel(model: string): boolean {
  return model.includes("gemini-3-flash") || model.includes("gemini-3.1-flash");
}

/**
 * Check if a model is a Claude model that supports extended thinking
 * (Sonnet, Opus - Haiku does NOT support thinking)
 */
export function isClaudeThinkingModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("claude-sonnet") || lower.includes("claude-opus");
}

/**
 * Check if a model is a DeepSeek V4 model (supports thinking via reasoning_content)
 * DeepSeek V4 supports: off, low, high (and extended internal efforts)
 */
export function isDeepSeekV4Model(model: string): boolean {
  return (
    model.startsWith("deepseek-v4") ||
    model === "deepseek/deepseek-v4-pro" ||
    model === "deepseek/deepseek-v4.1-flash"
  );
}

/**
 * Check if a model is the local Strata LLM model (supports off/low/medium/high thinking budget)
 */
export function isStrataLocalThinkingModel(model: string): boolean {
  return isStrataLocalModel(model);
}

/**
 * Check if a model supports thinking UI toggle
 * - Gemini 2.5+: thinkingBudget
 * - Gemini 3+/4+: thinkingLevel
 * - Claude Sonnet/Opus: extended thinking (budget_tokens)
 * - DeepSeek V4: reasoning_content (high/max)
 * - Local Strata LLM: reasoning_effort + reasoning_budget_tokens
 */
export function modelSupportsThinkingUI(model: string): boolean {
  return (
    isStrataLocalThinkingModel(model) ||
    isGemini25Model(model) ||
    isGemini3Model(model) ||
    isClaudeThinkingModel(model) ||
    isDeepSeekV4Model(model) ||
    isGLMModel(model)
  );
}

interface UseThinkingLevelResult {
  /** Current thinking level preference */
  thinkingLevel: ThinkingLevel;
  /** Update thinking level */
  setThinkingLevel: (level: ThinkingLevel) => void;
  /** Whether current model supports thinking level config */
  isThinkingEnabled: boolean;
  /** Whether current model supports extended levels (medium/minimal) */
  hasExtendedLevels: boolean;
  /** Available options for current model */
  availableLevels: ThinkingLevel[];
}

/**
 * Get available thinking levels for a model.
 */
export function getAvailableThinkingLevels(currentModel: string): ThinkingLevel[] {
  if (isStrataLocalThinkingModel(currentModel)) {
    return ["off", "low", "medium", "high"];
  }
  if (isGLMModel(currentModel)) return ["off", "high"];
  if (isClaudeThinkingModel(currentModel)) return ["off", "high"];
  if (isDeepSeekV4Model(currentModel)) return ["off", "low", "high"];
  if (isGemini25Model(currentModel)) return ["off", "low", "high"];
  if (isGemini4Model(currentModel)) {
    // Gemini 4 Argon cannot disable thinking; expose only ["low", "medium", "high"]
    return [...getSupportedGeminiThinkingLevels(currentModel)];
  }
  const geminiSupported = getSupportedGeminiThinkingLevels(currentModel);
  if (geminiSupported.length > 0) {
    return ["off", ...geminiSupported];
  }
  return ["off", "low", "high"];
}

/**
 * Single Source of Truth for effective thinking level derived at render time.
 * Maps requested thinking level to valid supported level for the current model.
 */
export function getEffectiveThinkingLevel(
  currentModel: string,
  requestedLevel: ThinkingLevel
): ThinkingLevel {
  if (isGemini4Model(currentModel)) {
    // Thinking cannot be disabled on Gemini 4; map "off" or "minimal" to "low"
    return clampGeminiThinkingLevel(
      currentModel,
      requestedLevel === "off" ? "low" : requestedLevel
    );
  }

  if (requestedLevel === "off" || !modelSupportsThinkingUI(currentModel)) {
    return "off";
  }

  if (isStrataLocalThinkingModel(currentModel)) {
    if (requestedLevel === "minimal") return "low";
    if (requestedLevel === "low" || requestedLevel === "medium" || requestedLevel === "high") {
      return requestedLevel;
    }
    return "off";
  }

  if (isGLMModel(currentModel)) {
    // GLM only supports off/high; any non-off level activates high reasoning
    return "high";
  }

  if (isClaudeThinkingModel(currentModel)) {
    // Claude only supports off/high; any non-off level activates extended thinking (high)
    return "high";
  }

  if (isDeepSeekV4Model(currentModel)) {
    // DeepSeek V4: minimal/low/medium -> low, high -> high (matches deepseek-request-builder.ts:35-75)
    if (requestedLevel === "high") {
      return "high";
    }
    return "low";
  }

  if (isGemini25Model(currentModel)) {
    // Gemini 2.5 dynamic thinking via thinkingBudget: -1
    if (requestedLevel === "high") {
      return "high";
    }
    return "low";
  }

  if (isGemini3Model(currentModel)) {
    // Gemini 3: clamp directly based on model capabilities
    return clampGeminiThinkingLevel(currentModel, requestedLevel);
  }

  return "off";
}

/**
 * Client-side preference store for Thinking Level.
 * - Persists to localStorage key: vikini.thinkingLevel
 * - Active for Gemini 2.5+ and Gemini 3+ models
 * - Default: "off" (no thinking mode)
 */
export function useThinkingLevel(currentModel: string): UseThinkingLevelResult {
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>("off");

  // Thinking toggle visible for Gemini 2.5, Gemini 3, Claude Sonnet/Opus, and DeepSeek V4
  const isThinkingEnabled = modelSupportsThinkingUI(currentModel);
  // Extended levels check via supported levels
  const hasExtendedLevels = getSupportedGeminiThinkingLevels(currentModel).includes("minimal");
  // Available levels based on model
  const availableLevels = getAvailableThinkingLevels(currentModel);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("vikini.thinkingLevel");
      if (stored && ["off", "high", "low", "medium", "minimal"].includes(stored)) {
        setThinkingLevelState(stored as ThinkingLevel);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  const setThinkingLevel = useCallback((level: ThinkingLevel) => {
    setThinkingLevelState(level);
    try {
      localStorage.setItem("vikini.thinkingLevel", level);
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    thinkingLevel,
    setThinkingLevel,
    isThinkingEnabled,
    hasExtendedLevels,
    availableLevels,
  };
}

const LEVEL_ORDER: Record<ThinkingLevel, number> = {
  off: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
};

/**
 * Returns the next lower thinking level from the available levels.
 * Only degrades to active thinking levels (minimal, low, medium, high), never to "off".
 * Returns null if current level is already at the lowest active level or no lower level is available.
 */
export function getLowerThinkingLevel(
  current: ThinkingLevel,
  availableLevels: ThinkingLevel[]
): ThinkingLevel | null {
  const currentRank = LEVEL_ORDER[current] ?? 0;
  const lowerCandidates = availableLevels
    .filter((lvl) => lvl !== "off" && (LEVEL_ORDER[lvl] ?? 0) < currentRank)
    .sort((a, b) => (LEVEL_ORDER[b] ?? 0) - (LEVEL_ORDER[a] ?? 0));

  return lowerCandidates[0] ?? null;
}
