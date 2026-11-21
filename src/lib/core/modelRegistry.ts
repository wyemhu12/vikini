// /lib/core/modelRegistry.ts
// Shared model registry for UI + backend.

export const DEFAULT_MODEL = "gemini-3.5-flash-lite" as const;

import { MODEL_IDS, STRATA_DEFAULTS } from "@/lib/utils/constants";

export const GLM_MAX_OUTPUT_TOKENS = 65536 as const;

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

export type ModelUiGroup = "gemini" | "anthropic" | "deepseek" | "grok" | "glm" | "groq" | "local";

export interface SelectableModel {
  id: string;
  descKey: string;
  name?: string;
  tokenLimit: number;
  contextWindow: number;
  maxOutputTokens?: number;
  category: "reasoning" | "low-latency" | "local";
  supportedThinkingLevels?: readonly GeminiThinkingLevel[];
  providerId:
    | "gemini"
    | "grok"
    | "anthropic"
    | "openrouter-free"
    | "openrouter-pay"
    | "openai"
    | "deepseek"
    | "groq"
    | "local";
  /** Brand-based grouping in Model Picker UI */
  uiGroup: ModelUiGroup;
  /** True only for Free Tier / Local models (Groq Free Tier + Strata Local) */
  isFree: boolean;
}

// Models shown in the UI selector (store these IDs in DB)
// Updated November 2026 — ordered by brand priority (Gemini first)
export const SELECTABLE_MODELS: readonly SelectableModel[] = [
  // ═══════════════════════════════════════════════════════════
  // GEMINI MODELS (Google AI — Primary)
  // ═══════════════════════════════════════════════════════════
  {
    id: "gemini-3.5-flash-lite",
    descKey: "modelDescFlashLite35",
    name: "Gemini 3.5 Flash-Lite",
    tokenLimit: 1048576,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    category: "low-latency",
    supportedThinkingLevels: ["minimal", "low", "medium", "high"],
    providerId: "gemini",
    uiGroup: "gemini",
    isFree: false,
  },
  {
    id: MODEL_IDS.GEMINI_4_HYDROGEN,
    descKey: "modelDescHydrogen4",
    name: "Gemini 4 Hydrogen",
    tokenLimit: 1048576,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    category: "low-latency",
    supportedThinkingLevels: ["low", "medium", "high", "xhigh"],
    providerId: "gemini",
    uiGroup: "gemini",
    isFree: false,
  },
  {
    id: MODEL_IDS.GEMINI_4_NEON,
    descKey: "modelDescNeon4",
    name: "Gemini 4 Neon",
    tokenLimit: 1048576,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    category: "reasoning",
    supportedThinkingLevels: ["low", "medium", "high", "xhigh"],
    providerId: "gemini",
    uiGroup: "gemini",
    isFree: false,
  },

  // ═══════════════════════════════════════════════════════════
  // CLAUDE 5.5 MODELS (Anthropic Direct / OpenRouter Fallback)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.CLAUDE_HAIKU_55,
    name: "Claude 5.5 Haiku",
    descKey: "modelDescClaudeHaiku",
    tokenLimit: 1000000,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    category: "low-latency",
    providerId: "anthropic",
    uiGroup: "anthropic",
    isFree: false,
  },
  {
    id: MODEL_IDS.CLAUDE_SONNET_55,
    name: "Claude 5.5 Sonnet",
    descKey: "modelDescClaudeSonnet",
    tokenLimit: 1000000,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    category: "reasoning",
    providerId: "anthropic",
    uiGroup: "anthropic",
    isFree: false,
  },

  // ═══════════════════════════════════════════════════════════
  // DEEPSEEK MODELS (Unified UI group — routed via OpenRouter)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.DEEPSEEK_V41_FLASH,
    name: "DeepSeek V4.1 Flash",
    descKey: "modelDescDeepSeekV41Flash",
    tokenLimit: 1048576,
    contextWindow: 1048576,
    maxOutputTokens: 384000,
    category: "low-latency",
    providerId: "openrouter-pay",
    uiGroup: "deepseek",
    isFree: false,
  },
  {
    id: MODEL_IDS.DEEPSEEK_V4_PRO,
    name: "DeepSeek V4 Pro",
    descKey: "modelDescDeepSeekV4Pro",
    tokenLimit: 1000000,
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    category: "reasoning",
    providerId: "openrouter-pay",
    uiGroup: "deepseek",
    isFree: false,
  },
  {
    id: MODEL_IDS.DEEPSEEK_V32,
    name: "DeepSeek V3.2",
    descKey: "modelDescDeepSeekV32",
    tokenLimit: 128000,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    category: "reasoning",
    providerId: "deepseek",
    uiGroup: "deepseek",
    isFree: false,
  },

  // ═══════════════════════════════════════════════════════════
  // GROK MODELS (xAI via OpenRouter)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.GROK_47,
    descKey: "modelDescGrok47",
    name: "Grok 4.7",
    tokenLimit: 500000,
    contextWindow: 500000,
    category: "reasoning",
    providerId: "grok",
    uiGroup: "grok",
    isFree: false,
  },

  // ═══════════════════════════════════════════════════════════
  // Z.AI / GLM 5.2 (via OpenRouter → CoreWeave FP4)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.GLM_52,
    name: "GLM 5.2",
    descKey: "modelDescGlm52",
    tokenLimit: 1048576,
    contextWindow: 1048576,
    maxOutputTokens: GLM_MAX_OUTPUT_TOKENS,
    category: "reasoning",
    providerId: "openrouter-pay",
    uiGroup: "glm",
    isFree: false,
  },

  // ═══════════════════════════════════════════════════════════
  // GROQ MODELS (Groq Cloud Free Tier)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.GROQ_GPT_OSS_120B,
    descKey: "modelDescGptOss120b",
    name: "GPT-OSS 120B",
    tokenLimit: 131072,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    category: "reasoning",
    providerId: "groq",
    uiGroup: "groq",
    isFree: true,
  },

  // ═══════════════════════════════════════════════════════════
  // LOCAL MODELS (Strata Local Inference Engine)
  // ═══════════════════════════════════════════════════════════
  {
    id: MODEL_IDS.STRATA_LOCAL,
    name: STRATA_DEFAULTS.DISPLAY_NAME,
    descKey: "modelDescStrataLocal",
    tokenLimit: STRATA_DEFAULTS.CONTEXT_WINDOW,
    contextWindow: STRATA_DEFAULTS.CONTEXT_WINDOW,
    maxOutputTokens: 16384,
    category: "local",
    providerId: "local",
    uiGroup: "local",
    isFree: true,
  },
] as const;

export const UI_GROUP_LABELS: Record<ModelUiGroup, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  grok: "Grok",
  glm: "GLM",
  groq: "Groq",
  local: "Local Models",
};

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  grok: "Grok", // xAI / OpenRouter
  deepseek: "DeepSeek",
  openai: "GPT",
  anthropic: "Claude",
  groq: "Groq", // Groq Cloud
  "openrouter-free": "OpenRouter (Free)",
  "openrouter-pay": "OpenRouter (Pay)",
  local: "Local Models",
};

const SELECTABLE_SET = new Set(SELECTABLE_MODELS.map((m) => m.id));

// Canonical IDs that are safe to send to respective APIs
const API_ALLOWED = new Set([
  // Gemini 3.5 & Image
  "gemini-3.5-flash-lite",
  "gemini-3-pro-image",

  // Gemini 4 (11/2026)
  MODEL_IDS.GEMINI_4_HYDROGEN,
  MODEL_IDS.GEMINI_4_NEON,

  // Claude 5.5 (Anthropic Direct / OpenRouter)
  MODEL_IDS.CLAUDE_HAIKU_55,
  MODEL_IDS.CLAUDE_SONNET_55,

  // DeepSeek via OpenRouter
  MODEL_IDS.DEEPSEEK_V41_FLASH,
  MODEL_IDS.DEEPSEEK_V4_PRO,
  MODEL_IDS.DEEPSEEK_V32,

  // Grok via OpenRouter
  MODEL_IDS.GROK_47,

  // Z.ai / GLM via OpenRouter
  MODEL_IDS.GLM_52,

  // Groq Free Tier
  MODEL_IDS.GROQ_GPT_OSS_120B,

  // Local LLM (Strata Engine)
  MODEL_IDS.STRATA_LOCAL,
]);

// Back-compat aliases and deprecations.
export const MODEL_ALIASES: Record<string, string> = {
  // Deprecated Gemini Flash-Lite / legacy models → Default
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-2.0-flash-exp": DEFAULT_MODEL,
  "gemini-1.5-pro": DEFAULT_MODEL,
  "gemini-1.5-flash": DEFAULT_MODEL,
  "gemini-2.5-flash": "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite-preview": "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",

  // Gemini 3 / 3.8 / 2.5 Pro deprecations → Gemini 4 Hydrogen
  "gemini-2.5-pro": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3-flash": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3-flash-preview": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3.8-flash": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3.1-pro-preview": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3.1-pro": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3-pro": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3-pro-preview": MODEL_IDS.GEMINI_4_HYDROGEN,
  "gemini-3-pro-image-preview": "gemini-3-pro-image",

  // Gemini 4 Argon → Gemini 4 Neon
  "gemini-4-argon": MODEL_IDS.GEMINI_4_NEON,
  "gemini-4-argon-preview": MODEL_IDS.GEMINI_4_NEON,

  // Claude 4.5 → Claude 5.5
  "claude-haiku-4.5": MODEL_IDS.CLAUDE_HAIKU_55,
  "claude-sonnet-4.5": MODEL_IDS.CLAUDE_SONNET_55,

  // DeepSeek legacy aliases → V4.1 Flash / V4 Pro
  "deepseek-chat": MODEL_IDS.DEEPSEEK_V41_FLASH,
  "deepseek-reasoner": MODEL_IDS.DEEPSEEK_V41_FLASH,
  "deepseek-v4-flash": MODEL_IDS.DEEPSEEK_V41_FLASH,
  "deepseek-v4-pro": MODEL_IDS.DEEPSEEK_V4_PRO,
  "deepseek-v4.1-flash": MODEL_IDS.DEEPSEEK_V41_FLASH,

  // Grok legacy aliases → Grok 4.7
  "x-ai/grok-4.3": MODEL_IDS.GROK_47,

  // Legacy Groq Llama models → GPT-OSS 120B (Groq Free Tier)
  "llama-3.3-70b-versatile": MODEL_IDS.GROQ_GPT_OSS_120B,
  "llama-3.1-8b-instant": MODEL_IDS.GROQ_GPT_OSS_120B,
  "llama3-70b-8192": MODEL_IDS.GROQ_GPT_OSS_120B,
  "llama3-8b-8192": MODEL_IDS.GROQ_GPT_OSS_120B,
  "llama-3.1-70b-versatile": MODEL_IDS.GROQ_GPT_OSS_120B,
  "llama-3.1-70b-specdec": MODEL_IDS.GROQ_GPT_OSS_120B,

  // Z.ai / GLM aliases
  "z-ai/glm-5.2-20260616": MODEL_IDS.GLM_52,
  "glm-5.2": MODEL_IDS.GLM_52,
} as const;

export function isSelectableModelId(modelId: unknown): boolean {
  const m = String(modelId || "").trim();
  if (m === MODEL_IDS.IMAGE_STUDIO || m === MODEL_IDS.NOVELCRAFTER) return true;
  return Boolean(m) && SELECTABLE_SET.has(m);
}

/**
 * Normalize a model id for Gemini API calls.
 * - Apply alias mapping
 * - Fallback to DEFAULT_MODEL if unknown
 */
export function normalizeModelForApi(modelId: unknown): string {
  const raw = String(modelId || "").trim();
  if (!raw) return DEFAULT_MODEL;

  if (raw === MODEL_IDS.IMAGE_STUDIO || raw === MODEL_IDS.NOVELCRAFTER) return raw;

  // Check aliases first (own keys only — inherited keys like "constructor" must not match)
  if (Object.hasOwn(MODEL_ALIASES, raw)) {
    return MODEL_ALIASES[raw];
  }

  // If it's already in API_ALLOWED, use it
  if (API_ALLOWED.has(raw)) {
    return raw;
  }

  // Fallback to default
  return DEFAULT_MODEL;
}

/**
 * Coerce a stored model ID to a valid selectable model.
 * Used when reading from DB/UI.
 */
export function coerceStoredModel(modelId: unknown): string {
  const normalized = normalizeModelForApi(modelId);
  // If normalized is selectable, use it; otherwise fallback to default
  return isSelectableModelId(normalized) ? normalized : DEFAULT_MODEL;
}

/**
 * Get token limit for a model.
 */
export function getModelTokenLimit(modelId: unknown): number {
  const model = SELECTABLE_MODELS.find((m) => m.id === coerceStoredModel(modelId));
  return model?.tokenLimit || SELECTABLE_MODELS[0]?.tokenLimit || 1000000;
}

/**
 * Get max output token limit for a model.
 */
export function getModelMaxOutputTokens(modelId: unknown): number | undefined {
  const model = SELECTABLE_MODELS.find((m) => m.id === coerceStoredModel(modelId));
  return model?.maxOutputTokens;
}

/**
 * Check if a model belongs to the Gemini 4 family (where thinking cannot be disabled)
 */
export function isGemini4Model(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId);
  return normalized.startsWith("gemini-4");
}

/**
 * Check if a model supports thinking mode (thinkingConfig with thinkingLevel).
 *
 * IMPORTANT: Gemini 3+ and Gemini 4+ models support the `thinkingLevel` parameter.
 * Legacy Gemini 2.5 IDs normalize to Gemini 3.5/3.8 via MODEL_ALIASES.
 */
export function modelSupportsThinking(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId);
  // Hỗ trợ ThinkingConfig (thinkingLevel) cho các mô hình Gemini 3 và Gemini 4
  return normalized.startsWith("gemini-3") || normalized.startsWith("gemini-4");
}

/**
 * Get supported thinking levels for a Gemini model.
 * Single source of truth derived from SELECTABLE_MODELS with fallback for non-selectable Gemini 3/4 models.
 */
export function getSupportedGeminiThinkingLevels(modelId: unknown): readonly GeminiThinkingLevel[] {
  const normalized = normalizeModelForApi(modelId);
  const found = SELECTABLE_MODELS.find((m) => m.id === normalized);
  if (found?.supportedThinkingLevels) {
    return found.supportedThinkingLevels;
  }
  // Fallback cho các mô hình Gemini 3/4 có trong API_ALLOWED nhưng không nằm trong SELECTABLE_MODELS (ví dụ: gemini-3-pro-image)
  if (normalized.startsWith("gemini-3") || normalized.startsWith("gemini-4")) {
    if (normalized.includes("flash")) {
      return ["minimal", "low", "medium", "high"];
    }
    return ["low", "medium", "high"];
  }
  return [];
}

const GEMINI_LEVEL_RANK: Record<GeminiThinkingLevel, number> = {
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
};

/**
 * Clamp requested thinking level to supported range for a Gemini model.
 * If requested level is supported, returns it directly.
 * Otherwise, clamps directionally (e.g. xhigh -> high on 3.5-flash-lite; off/minimal -> low on gemini-4-*).
 */
export function clampGeminiThinkingLevel(
  modelId: unknown,
  requestedLevel: string
): GeminiThinkingLevel {
  const supported = getSupportedGeminiThinkingLevels(modelId);
  if (supported.length === 0) return "low";
  if (supported.includes(requestedLevel as GeminiThinkingLevel)) {
    return requestedLevel as GeminiThinkingLevel;
  }
  const reqRank = GEMINI_LEVEL_RANK[requestedLevel as GeminiThinkingLevel];
  const maxSupported = supported[supported.length - 1];
  if (reqRank !== undefined && reqRank > GEMINI_LEVEL_RANK[maxSupported]) {
    return maxSupported;
  }
  return supported[0];
}

/**
 * Check if a model routes via Groq Cloud (based on providerId, safe for IDs containing "/").
 */
export function isGroqModel(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId);
  const found = SELECTABLE_MODELS.find((m) => m.id === normalized);
  return found?.providerId === "groq";
}

/**
 * Check if a model belongs to the Claude 5.5 family (uses Adaptive Thinking without budget_tokens).
 * Checks raw string alongside normalized ID so snapshot IDs don't fallback to DEFAULT_MODEL.
 */
export function isClaude55Model(modelId: unknown): boolean {
  const raw = String(modelId || "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  const normalized = normalizeModelForApi(raw).toLowerCase();
  return (
    raw.includes("claude-sonnet-5") ||
    raw.includes("claude-haiku-5") ||
    normalized === MODEL_IDS.CLAUDE_SONNET_55 ||
    normalized === MODEL_IDS.CLAUDE_HAIKU_55
  );
}

/**
 * Check if a Claude model supports thinking mode.
 * Claude Sonnet/Opus and Claude 5.5 Haiku support thinking (5.5 uses Adaptive Thinking).
 */
export function modelSupportsClaudeThinking(modelId: unknown): boolean {
  const raw = String(modelId || "")
    .trim()
    .toLowerCase();
  if (!raw) return false;
  const normalized = normalizeModelForApi(raw).toLowerCase();
  return (
    raw.includes("claude-sonnet") ||
    raw.includes("claude-opus") ||
    raw.includes("claude-haiku-5") ||
    normalized.includes("claude-sonnet") ||
    normalized.includes("claude-opus") ||
    normalized.includes("claude-haiku-5")
  );
}

export function isDeepSeekV4ProModel(modelId: unknown): boolean {
  const id = String(modelId || "").trim();
  return id === MODEL_IDS.DEEPSEEK_V4_PRO;
}

export function isDeepSeekV41FlashModel(modelId: unknown): boolean {
  const id = String(modelId || "").trim();
  return id === MODEL_IDS.DEEPSEEK_V41_FLASH;
}

/**
 * Check if a DeepSeek model supports thinking mode.
 * DeepSeek V4 Pro and V4.1 Flash (via OpenRouter) support reasoning.
 */
export function modelSupportsDeepSeekThinking(modelId: unknown): boolean {
  const normalized = normalizeModelForApi(modelId);
  return isDeepSeekV4ProModel(normalized) || isDeepSeekV41FlashModel(normalized);
}

/**
 * Check if a model is the local Strata LLM model.
 */
export function isStrataLocalModel(modelId: unknown): boolean {
  const raw = String(modelId || "").trim();
  if (!raw) return false;
  return normalizeModelForApi(raw) === MODEL_IDS.STRATA_LOCAL;
}

/**
 * Check if a model supports web search (grounding).
 * DeepSeek V4 Pro and Strata Local have no web search tool.
 * DeepSeek V3.2 (OpenRouter) supports web search via `openrouter:web_search` server tool.
 * Gemini uses googleSearch, Claude uses web_search - both supported.
 */
export function modelSupportsWebSearch(modelId: unknown): boolean {
  const id = String(modelId || "")
    .trim()
    .toLowerCase();
  if (isStrataLocalModel(id)) return false;
  if (isDeepSeekV4ProModel(id)) return false;
  return true;
}

/**
 * Check if model is DeepSeek V3.2 via OpenRouter.
 * Used to inject `openrouter:web_search` server tool.
 */
export function isDeepSeekV32Model(modelId: unknown): boolean {
  const id = String(modelId || "")
    .trim()
    .toLowerCase();
  return id.includes("deepseek") && id.includes("v3.2");
}

/**
 * Check if a model is a Z.ai / GLM model.
 */
export function isGLMModel(modelId: unknown): boolean {
  const id = String(modelId || "")
    .trim()
    .toLowerCase();
  return id === MODEL_IDS.GLM_52 || id.startsWith("z-ai/glm") || id.startsWith("glm-");
}

/**
 * Check if a model is an OpenRouter reasoning model (e.g. Grok 4.3, GLM 5.2)
 */
export function isOpenRouterReasoningModel(modelId: unknown): boolean {
  const id = String(modelId || "")
    .trim()
    .toLowerCase();
  return id.includes("x-ai/grok") || id.includes("o1") || id.includes("o3") || isGLMModel(id);
}
