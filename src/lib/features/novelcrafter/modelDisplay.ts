// /lib/features/novelcrafter/modelDisplay.ts
// Resolves human-friendly display name and provider label for AI models on History Cards (NC-13, NC-14)

import {
  DEFAULT_MODEL,
  PROVIDER_LABELS,
  SELECTABLE_MODELS,
  normalizeModelForApi,
} from "@/lib/core/modelRegistry";

export interface ModelDisplayInfo {
  id: string;
  displayName: string;
  providerId: string;
  providerLabel: string;
  routedVia?: string;
}

const DIRECT_API_MODEL_DISPLAY_MAP: Record<string, string> = {
  "claude-sonnet-4-6": "claude-sonnet-4.5",
  "claude-haiku-4-5-20251001": "claude-haiku-4.5",
  "anthropic/claude-sonnet-4-6": "claude-sonnet-4.5",
  "anthropic/claude-sonnet-4.6": "claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5": "claude-haiku-4.5",
};

export function resolveModelDisplayInfo(
  modelId: string | undefined | null,
  routedModel?: string | null
): ModelDisplayInfo {
  const raw = String(modelId || "").trim();
  if (!raw) {
    return {
      id: "unknown",
      displayName: "AI Model",
      providerId: "unknown",
      providerLabel: "AI",
    };
  }

  const mappedRaw = DIRECT_API_MODEL_DISPLAY_MAP[raw] || raw;
  const exact = SELECTABLE_MODELS.find((m) => m.id === mappedRaw);
  const normalized = normalizeModelForApi(mappedRaw);
  const byNormalized =
    exact ||
    (normalized !== DEFAULT_MODEL || mappedRaw === DEFAULT_MODEL
      ? SELECTABLE_MODELS.find((m) => m.id === normalized)
      : undefined);

  const routed =
    routedModel && routedModel.trim() && routedModel.trim() !== raw
      ? routedModel.trim()
      : undefined;

  if (byNormalized) {
    const providerId = byNormalized.providerId;
    return {
      id: byNormalized.id,
      displayName: byNormalized.name || byNormalized.id,
      providerId,
      providerLabel: PROVIDER_LABELS[providerId] || providerId,
      ...(routed ? { routedVia: routed } : {}),
    };
  }

  return {
    id: raw,
    displayName: raw,
    providerId: "custom",
    providerLabel: "Custom",
    ...(routed ? { routedVia: routed } : {}),
  };
}
