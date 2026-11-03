// /lib/core/geminiSdkHelpers.ts
// Shared server-side helpers for one-shot @google/genai generateContent calls

import { ThinkingLevel } from "@google/genai";
import {
  clampGeminiThinkingLevel,
  modelSupportsThinking,
  type GeminiThinkingLevel,
} from "@/lib/core/modelRegistry";

const SDK_THINKING_LEVEL: Record<GeminiThinkingLevel, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

/**
 * Cheapest valid thinkingConfig for short one-shot Gemini calls (titles, prompt rewrite,
 * image description). Clamps "minimal" to the model's lowest supported level
 * (gemini-3.8-flash -> LOW). Returns undefined for models without thinkingLevel support.
 */
export function buildMinimalThinkingConfig(
  modelId: string
): { thinkingLevel: ThinkingLevel } | undefined {
  if (!modelSupportsThinking(modelId)) return undefined;
  return { thinkingLevel: SDK_THINKING_LEVEL[clampGeminiThinkingLevel(modelId, "minimal")] };
}

/**
 * Reads answer text from a generateContent response. Never returns thought parts:
 * the SDK `.text` getter already skips them; the candidates fallback filters
 * `thought === true` and joins remaining string `text` parts.
 */
export function extractGeminiResponseText(resp: unknown): string {
  if (!isRecord(resp)) return "";

  if (typeof resp.text === "function") {
    try {
      const val = (resp.text as () => unknown)();
      if (typeof val === "string") return val;
    } catch {
      // Fall through to candidates fallback
    }
  } else if (typeof resp.text === "string") {
    return resp.text;
  }

  const candidates = resp.candidates;
  if (!Array.isArray(candidates) || !isRecord(candidates[0])) return "";
  const content = candidates[0].content;
  if (!isRecord(content) || !Array.isArray(content.parts)) return "";

  return content.parts
    .filter((p): p is { text: string; thought?: unknown } => {
      return isRecord(p) && p.thought !== true && typeof p.text === "string";
    })
    .map((p) => p.text)
    .join("");
}
