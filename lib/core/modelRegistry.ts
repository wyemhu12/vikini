// /lib/core/modelRegistry.ts
// Shared model registry for UI + backend.

export const DEFAULT_MODEL = "gemini-2.5-flash" as const;

export interface SelectableModel {
  id: string;
  descKey: string;
  name?: string;
  tokenLimit: number;
  contextWindow: number;
}

// Models shown in the UI selector (store these IDs in DB)
// Updated December 2025 with latest available models
export const SELECTABLE_MODELS: readonly SelectableModel[] = [
  // ═══════════════════════════════════════════════════════════
  // GEMINI MODELS (Google AI)
  // ═══════════════════════════════════════════════════════════

  // Gemini 2.5 Series (GA June 2025, available now)
  {
    id: "gemini-2.5-flash",
    descKey: "modelDescFlash25",
    name: "Gemini 2.5 Flash",
    tokenLimit: 1000000,
    contextWindow: 1000000,
  },
  {
    id: "gemini-2.5-pro",
    descKey: "modelDescPro25",
    name: "Gemini 2.5 Pro",
    tokenLimit: 2000000,
    contextWindow: 2000000,
  },

  // Gemini 3 Series (Latest - Dec 2025)
  {
    id: "gemini-3-flash-preview",
    descKey: "modelDescFlash3",
    name: "Gemini 3 Flash",
    tokenLimit: 1000000,
    contextWindow: 1000000,
  },
  {
    id: "gemini-3-pro-preview",
    descKey: "modelDescPro3",
    name: "Gemini 3 Pro",
    tokenLimit: 2000000,
    contextWindow: 2000000,
  },
  {
    id: "gemini-3-flash-thinking",
    descKey: "modelDescFlash3",
    name: "Gemini 3 Flash (Thinking)",
    tokenLimit: 1000000,
    contextWindow: 1000000,
  },
  {
    id: "gemini-3-pro-thinking",
    descKey: "modelDescPro3",
    name: "Gemini 3 Pro (Thinking)",
    tokenLimit: 2000000,
    contextWindow: 2000000,
  },

  // ═══════════════════════════════════════════════════════════
  // GROQ MODELS (Llama via Groq API)
  // ═══════════════════════════════════════════════════════════
  {
    id: "llama-3.3-70b-versatile",
    descKey: "modelDescLlama33_70b",
    name: "Llama 3.3 70B Versatile",
    tokenLimit: 128000,
    contextWindow: 128000,
  },
  {
    id: "llama-3.1-8b-instant",
    descKey: "modelDescLlama31_8b",
    name: "Llama 3.1 8B Instant",
    tokenLimit: 128000,
    contextWindow: 128000,
  },

  // ═══════════════════════════════════════════════════════════
  // OPENROUTER FREE MODELS (December 2025)
  // ═══════════════════════════════════════════════════════════

  // DeepSeek - Free, very powerful
  {
    id: "deepseek/deepseek-chat:free",
    name: "DeepSeek V3 Chat (Free)",
    descKey: "modelDescDeepSeekV3",
    tokenLimit: 128000,
    contextWindow: 128000,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 Reasoning (Free)",
    descKey: "modelDescDeepSeekR1",
    tokenLimit: 64000,
    contextWindow: 64000,
  },

  // Meta Llama 4 - Free via OpenRouter
  {
    id: "meta-llama/llama-4-maverick:free",
    name: "Llama 4 Maverick (Free)",
    descKey: "modelDescLlama4Maverick",
    tokenLimit: 256000,
    contextWindow: 256000,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (Free)",
    descKey: "modelDescLlama33Instruct",
    tokenLimit: 128000,
    contextWindow: 128000,
  },

  // Google Gemma - Free
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B (Free)",
    descKey: "modelDescGemma3",
    tokenLimit: 96000,
    contextWindow: 96000,
  },

  // Mistral - Free
  {
    id: "mistral/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1 24B (Free)",
    descKey: "modelDescMistralSmall",
    tokenLimit: 32000,
    contextWindow: 32000,
  },

  // ═══════════════════════════════════════════════════════════
  // CLAUDE MODELS (Anthropic API)
  // Get API key at: https://console.anthropic.com/
  // Free tier: $10/month, 5 req/min
  // ═══════════════════════════════════════════════════════════
  {
    id: "claude-haiku-4.5",
    name: "Claude 4.5 Haiku (Fast)",
    descKey: "modelDescClaudeHaiku",
    tokenLimit: 200000,
    contextWindow: 200000,
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude 4.5 Sonnet",
    descKey: "modelDescClaudeSonnet",
    tokenLimit: 200000,
    contextWindow: 200000,
  },
] as const;

const SELECTABLE_SET = new Set(SELECTABLE_MODELS.map((m) => m.id));

// Canonical IDs that are safe to send to respective APIs
const API_ALLOWED = new Set([
  // Gemini 2.5
  "gemini-2.5-flash",
  "gemini-2.5-pro",

  // Gemini 3 official IDs (with -preview suffix)
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3-pro-image-preview",
  "gemini-3-flash-thinking",
  "gemini-3-pro-thinking",

  // Llama via Groq
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",

  // OpenRouter Free Models
  "deepseek/deepseek-chat:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-4-maverick:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistral/mistral-small-3.1-24b-instruct:free",

  // Claude (Anthropic)
  "claude-haiku-4.5",
  "claude-sonnet-4.5",
]);

// Back-compat aliases and deprecations.
// - DB/UI may store aliases.
// - Gemini 3 official IDs include `-preview`.
export const MODEL_ALIASES: Record<string, string> = {
  // Deprecated models → Default
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-2.0-flash-exp": DEFAULT_MODEL,
  "gemini-1.5-pro": DEFAULT_MODEL,
  "gemini-1.5-flash": DEFAULT_MODEL,

  // Gemini 3 aliases → official preview IDs
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  "gemini-3-pro-image": "gemini-3-pro-image-preview",

  // Legacy Groq Llama models
  "llama3-70b-8192": "llama-3.3-70b-versatile",
  "llama3-8b-8192": "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile": "llama-3.3-70b-versatile", // Deprecated Dec 2024
  "llama-3.1-70b-specdec": "llama-3.3-70b-versatile",
} as const;

export function isSelectableModelId(modelId: unknown): boolean {
  const m = String(modelId || "").trim();
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

  // Check aliases first
  if (MODEL_ALIASES[raw]) {
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
