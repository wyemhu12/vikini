// /lib/features/novelcrafter/aiInheritanceTable.ts
// Pure resolvers for Novelcrafter AI Settings inheritance table (Master GEM, Master Persona, per-slot Persona & Model)

import { isModelAllowedById } from "@/lib/core/modelAccess";
import {
  coerceStoredModel,
  isSelectableModelId,
  SELECTABLE_MODELS,
} from "@/lib/core/modelRegistry";
import {
  NOVELCRAFTER_FEATURE_SLOTS,
  type NovelcrafterFeatureSlot,
  type NovelcrafterRoutingConfig,
} from "./types";

export interface CatalogItemSummary {
  id: string;
  name: string;
}

export type ResolvedPersonaSource = "inherit" | "override" | "disabled";

export interface EffectiveSlotModelResult {
  modelId: string;
  modelName: string;
  isOverridden: boolean;
}

export interface FeatureInheritanceRow {
  slot: NovelcrafterFeatureSlot;
  personaSelectValue: string;
  personaSource: ResolvedPersonaSource;
  effectivePersonaName: string | null;
  isPersonaOverridden: boolean;
  modelSelectValue: string;
  effectiveModelId: string;
  effectiveModelName: string;
  isModelOverridden: boolean;
  isRowOverridden: boolean;
  masterGemName: string | null;
}

export function getSelectableModelDisplayName(modelId: string): string {
  const coerced = coerceStoredModel(modelId);
  const found = SELECTABLE_MODELS.find((m) => m.id === modelId || m.id === coerced);
  return found?.name || modelId;
}

export function resolveEffectiveSlotModel(
  feature: NovelcrafterFeatureSlot,
  defaultModelId: string,
  routing: NovelcrafterRoutingConfig,
  allowedModelIds?: ReadonlySet<string> | readonly string[]
): EffectiveSlotModelResult {
  const fallbackName = getSelectableModelDisplayName(defaultModelId);
  const rawSlot = routing.featureModels?.[feature]?.trim();
  if (!rawSlot || rawSlot === "inherit") {
    return {
      modelId: defaultModelId,
      modelName: fallbackName,
      isOverridden: false,
    };
  }

  const coerced = coerceStoredModel(rawSlot);
  if (!isSelectableModelId(coerced)) {
    return {
      modelId: defaultModelId,
      modelName: fallbackName,
      isOverridden: false,
    };
  }

  if (allowedModelIds && !isModelAllowedById(coerced, allowedModelIds)) {
    return {
      modelId: defaultModelId,
      modelName: fallbackName,
      isOverridden: false,
    };
  }

  return {
    modelId: coerced,
    modelName: getSelectableModelDisplayName(coerced),
    isOverridden: coerced !== defaultModelId,
  };
}

export interface ResolveFeatureInheritanceRowsInput {
  routing: NovelcrafterRoutingConfig;
  defaultModelId: string;
  gems: readonly CatalogItemSummary[];
  personas: readonly CatalogItemSummary[];
  allowedModelIds?: ReadonlySet<string> | readonly string[];
}

export function resolveFeatureInheritanceRows({
  routing,
  defaultModelId,
  gems,
  personas,
  allowedModelIds,
}: ResolveFeatureInheritanceRowsInput): FeatureInheritanceRow[] {
  const masterGemId = routing.masterGemId?.trim() || null;
  const masterPersonaId = routing.masterPersonaId?.trim() || null;
  const masterGemName = masterGemId ? (gems.find((g) => g.id === masterGemId)?.name ?? null) : null;
  const masterPersonaName = masterPersonaId
    ? (personas.find((p) => p.id === masterPersonaId)?.name ?? null)
    : null;

  return NOVELCRAFTER_FEATURE_SLOTS.map((slot) => {
    const rawPersona = routing.featurePersonas[slot]?.trim() || "inherit";
    let personaSource: ResolvedPersonaSource = "inherit";
    let effectivePersonaName: string | null = masterPersonaName;
    let isPersonaOverridden = false;

    if (rawPersona === "none") {
      personaSource = "disabled";
      effectivePersonaName = null;
      isPersonaOverridden = true;
    } else if (rawPersona !== "inherit") {
      personaSource = "override";
      effectivePersonaName = personas.find((p) => p.id === rawPersona)?.name ?? null;
      isPersonaOverridden = true;
    }

    const resolvedModel = resolveEffectiveSlotModel(slot, defaultModelId, routing, allowedModelIds);
    const modelSelectValue = resolvedModel.isOverridden ? resolvedModel.modelId : "inherit";

    return {
      slot,
      personaSelectValue: rawPersona,
      personaSource,
      effectivePersonaName,
      isPersonaOverridden,
      modelSelectValue,
      effectiveModelId: resolvedModel.modelId,
      effectiveModelName: resolvedModel.modelName,
      isModelOverridden: resolvedModel.isOverridden,
      isRowOverridden: isPersonaOverridden || resolvedModel.isOverridden,
      masterGemName,
    };
  });
}

export function estimatePromptTokens(xml: string): number {
  const trimmed = xml.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

export function formatApproxTokens(tokens: number, locale: "vi" | "en"): string {
  if (tokens < 1000) {
    return String(tokens);
  }
  const rounded = (tokens / 1000).toFixed(1).replace(/\.0$/, "");
  return locale === "vi" ? `${rounded.replace(".", ",")}k` : `${rounded}k`;
}
