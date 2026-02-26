// /app/features/chat/components/hooks/useThinkingLevel.ts
"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Thinking levels supported by Gemini models.
 * - "off" (default): No thinking mode
 * - "low": Faster responses, less reasoning
 * - "medium": Balanced (Flash only)
 * - "high": Maximum reasoning depth
 * - "minimal": Near-zero thinking (Flash only)
 */
export type ThinkingLevel = "off" | "high" | "low" | "medium" | "minimal";

/**
 * Check if a model is a Gemini 3 model (supports thinkingLevel config)
 */
export function isGemini3Model(model: string): boolean {
  return model.includes("gemini-3") || model.includes("gemini-3.");
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
  return model.includes("gemini-3-flash");
}

/**
 * Check if a model supports thinking UI toggle (Gemini 2.5+ or Gemini 3+)
 * Backend will handle API format differences (thinkingBudget vs thinkingLevel)
 */
export function modelSupportsThinkingUI(model: string): boolean {
  return isGemini25Model(model) || isGemini3Model(model);
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
 * Client-side preference store for Thinking Level.
 * - Persists to localStorage key: vikini.thinkingLevel
 * - Active for Gemini 2.5+ and Gemini 3+ models
 * - Default: "off" (no thinking mode)
 */
export function useThinkingLevel(currentModel: string): UseThinkingLevelResult {
  const [thinkingLevel, setThinkingLevelState] = useState<ThinkingLevel>("off");

  // Thinking toggle visible for both Gemini 2.5 and Gemini 3
  const isThinkingEnabled = modelSupportsThinkingUI(currentModel);
  // Extended levels only for Gemini 3 Flash
  const hasExtendedLevels = isGemini3FlashModel(currentModel);

  // Available levels based on model
  // Gemini 2.5: simple on/off (high = dynamic thinkingBudget)
  // Gemini 3 Flash: full range
  // Gemini 3 Pro: basic levels
  const availableLevels: ThinkingLevel[] = hasExtendedLevels
    ? ["off", "minimal", "low", "medium", "high"]
    : ["off", "low", "high"];

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
