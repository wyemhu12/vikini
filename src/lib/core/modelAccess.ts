// /lib/core/modelAccess.ts
// Pure, client-safe helper for checking if a model is allowed based on user limits.
// Shares exact normalization logic with limits.ts without requiring server-side database dependencies.

import {
  isSelectableModelId,
  normalizeModelForApi,
  coerceStoredModel,
  MODEL_ALIASES,
} from "./modelRegistry";
import { MODEL_IDS } from "../utils/constants";

/**
 * Checks if a model ID is allowed given a user's allowed model list/set.
 * - Handles exact IDs, API normalized IDs, and stored coerced aliases.
 * - Blocks unknown/garbage strings from false-positive matching DEFAULT_MODEL.
 * - If allowedModelIds is empty, permits all valid models (e.g. unconstrained or loading).
 */
export function isModelAllowedById(
  modelId: string,
  allowedModelIds: ReadonlySet<string> | readonly string[]
): boolean {
  const trimmed = modelId.trim();
  if (!trimmed) return false;

  const allowedSet = allowedModelIds instanceof Set ? allowedModelIds : new Set(allowedModelIds);

  // If no restrictions are specified, permit any valid selectable model
  if (allowedSet.size === 0) {
    return isSelectableModelId(trimmed) || Object.hasOwn(MODEL_ALIASES, trimmed);
  }

  // Studios are internal models and always permitted for whitelisted users
  if (trimmed === MODEL_IDS.NOVELCRAFTER || trimmed === MODEL_IDS.IMAGE_STUDIO) {
    return true;
  }

  const isKnown = isSelectableModelId(trimmed) || Object.hasOwn(MODEL_ALIASES, trimmed);
  if (!isKnown) {
    return false;
  }

  const normalized = normalizeModelForApi(trimmed);
  const coerced = coerceStoredModel(trimmed);

  // Check direct match on the requested model
  if (allowedSet.has(trimmed) || allowedSet.has(normalized) || allowedSet.has(coerced)) {
    return true;
  }

  // Check reverse match against allowed items (if user has alias or normalized form in allowed list)
  for (const item of allowedSet) {
    if (
      item === trimmed ||
      item === normalized ||
      item === coerced ||
      normalizeModelForApi(item) === normalized ||
      coerceStoredModel(item) === coerced
    ) {
      return true;
    }
  }

  return false;
}
