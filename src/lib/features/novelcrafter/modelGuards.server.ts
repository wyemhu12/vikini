// /lib/features/novelcrafter/modelGuards.server.ts
// Shared server-side model validation for Novelcrafter state and stream endpoints (NC-32)

import { DEFAULT_MODEL, isSelectableModelId, normalizeModelForApi } from "@/lib/core/modelRegistry";
import { MODEL_IDS } from "@/lib/utils/constants";

export function isValidGenerationModel(modelId: string): boolean {
  const trimmed = modelId.trim();
  if (!trimmed) return false;
  if (trimmed === MODEL_IDS.NOVELCRAFTER || trimmed === MODEL_IDS.IMAGE_STUDIO) {
    return false;
  }
  if (isSelectableModelId(trimmed)) return true;
  const normalized = normalizeModelForApi(trimmed);
  if (normalized !== DEFAULT_MODEL) return true;
  return trimmed === DEFAULT_MODEL;
}
