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
export const SELECTABLE_MODELS: readonly SelectableModel[] = [
  {
    id: "gemini-2.5-flash",
    descKey: "modelDescFlash25",
    tokenLimit: 1000000,
    contextWindow: 1000000,
  },
  { id: "gemini-2.5-pro", descKey: "modelDescPro25", tokenLimit: 2000000, contextWindow: 2000000 },
  { id: "gemini-3-flash", descKey: "modelDescFlash3", tokenLimit: 1000000, contextWindow: 1000000 },
  { id: "gemini-3-pro", descKey: "modelDescPro3", tokenLimit: 2000000, contextWindow: 2000000 },
  {
    id: "llama-3.3-70b-versatile",
    descKey: "modelDescLlama33_70b",
    tokenLimit: 128000,
    contextWindow: 128000,
  },
  {
    id: "llama-3.1-8b-instant",
    descKey: "modelDescLlama31_8b",
    tokenLimit: 128000,
    contextWindow: 128000,
  },
  {
    id: "cognitivecomputations/dolphin-mixtral-8x7b",
    name: "Dolphin Mixtral 8x7B (Paid)",
    descKey: "modelDescDolphinMix",
    tokenLimit: 32768,
    contextWindow: 32768,
  },
  {
    id: "cognitivecomputations/dolphin-llama-3-70b",
    name: "Dolphin Llama 3 70B (Paid)",
    descKey: "modelDescDolphinL3",
    tokenLimit: 8192,
    contextWindow: 8192,
  },
  {
    id: "venice/dolphin-mistral-24b",
    name: "Dolphin Mistral 24B (Free)",
    descKey: "modelDescDolphinMistral24",
    tokenLimit: 32768,
    contextWindow: 32768,
  },
] as const;

const SELECTABLE_SET = new Set(SELECTABLE_MODELS.map((m) => m.id));

// Canonical IDs that are safe to send to Gemini API (including official preview IDs)
const API_ALLOWED = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-pro-image-preview",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "cognitivecomputations/dolphin-mixtral-8x7b",
  "cognitivecomputations/dolphin-llama-3-70b",
  "venice/dolphin-mistral-24b",
]);

// Back-compat aliases and deprecations.
// - DB/UI may store aliases.
// - Gemini 3 official IDs include `-preview`.
export const MODEL_ALIASES: Record<string, string> = {
  // Deprecated models
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-1.5-pro": DEFAULT_MODEL,

  // Gemini 3 aliases -> official preview IDs
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  "gemini-3-pro-image": "gemini-3-pro-image-preview",

  // Legacy Groq models
  "llama3-70b-8192": "llama-3.3-70b-versatile",
  "llama3-8b-8192": "llama-3.1-8b-instant",
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
