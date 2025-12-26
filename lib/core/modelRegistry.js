// /lib/core/modelRegistry.js
// Shared model registry for UI + backend.

export const DEFAULT_MODEL = "gemini-2.5-flash";

// Models shown in the UI selector (store these IDs in DB)
export const SELECTABLE_MODELS = [
  { id: "gemini-2.5-flash", descKey: "modelDescFlash25" },
  { id: "gemini-2.5-pro", descKey: "modelDescPro25" },
  { id: "gemini-3-flash", descKey: "modelDescFlash3" },
  { id: "gemini-3-pro", descKey: "modelDescPro3" },
];

const SELECTABLE_SET = new Set(SELECTABLE_MODELS.map((m) => m.id));

// Canonical IDs that are safe to send to Gemini API (including official preview IDs)
const API_ALLOWED = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-3-pro-image-preview",
]);

// Back-compat aliases and deprecations.
// - DB/UI may store aliases.
// - Gemini 3 official IDs include `-preview`.
export const MODEL_ALIASES = {
  // Deprecated models
  "gemini-2.0-flash": DEFAULT_MODEL,
  "gemini-1.5-pro": DEFAULT_MODEL,

  // Gemini 3 aliases -> official preview IDs
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  "gemini-3-pro-image": "gemini-3-pro-image-preview",
};

export function isSelectableModelId(modelId) {
  const m = String(modelId || "").trim();
  return Boolean(m) && SELECTABLE_SET.has(m);
}

/**
 * Normalize a model id for Gemini API calls.
 * - Apply alias mapping
 * - Fallback to DEFAULT_MODEL if unknown
 */
export function normalizeModelForApi(modelId) {
  const raw = String(modelId || "").trim();
  if (!raw) return DEFAULT_MODEL;

  const mapped = MODEL_ALIASES[raw] || raw;
  if (API_ALLOWED.has(mapped)) return mapped;
  if (API_ALLOWED.has(raw)) return raw;
  return DEFAULT_MODEL;
}

/**
 * Validate / coerce a stored model value (e.g. from UI or DB) to a safe stored id.
 * - Prefer selectable models (UI ids)
 * - Accept API preview ids (keep as-is)
 * - Fallback to DEFAULT_MODEL
 */
export function coerceStoredModel(modelId) {
  const raw = String(modelId || "").trim();
  if (!raw) return DEFAULT_MODEL;
  if (isSelectableModelId(raw)) return raw;
  if (API_ALLOWED.has(raw)) return raw;
  // Accept deprecated values but coerce to default
  if (MODEL_ALIASES[raw] === DEFAULT_MODEL) return DEFAULT_MODEL;
  return DEFAULT_MODEL;
}
