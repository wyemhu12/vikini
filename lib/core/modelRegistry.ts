// /lib/core/modelRegistry.ts
// Shared model registry for UI + backend.

export const DEFAULT_MODEL = "gemini-2.5-flash" as const;

export interface SelectableModel {
  id: string;
  descKey: string;
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
  { id: "llama3-70b-8192", descKey: "modelDescLlama3_70b", tokenLimit: 8192, contextWindow: 8192 },
  { id: "llama3-8b-8192", descKey: "modelDescLlama3_8b", tokenLimit: 8192, contextWindow: 8192 },
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
  "llama3-70b-8192",
  "llama3-8b-8192",
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
