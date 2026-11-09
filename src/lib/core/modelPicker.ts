// Pure model-picker logic: filters, search, sections (recent + per provider) and display names.

import {
  MODEL_ALIASES,
  PROVIDER_LABELS,
  SELECTABLE_MODELS,
  type SelectableModel,
} from "@/lib/core/modelRegistry";

export const MODEL_FILTERS = ["all", "fast", "reasoning", "free", "local"] as const;
export type ModelFilter = (typeof MODEL_FILTERS)[number];

export type ProviderId = SelectableModel["providerId"];

/** Provider group order in the picker (unchanged from the previous selector). */
export const PROVIDER_ORDER: readonly ProviderId[] = [
  "gemini",
  "grok",
  "deepseek",
  "openai",
  "anthropic",
  "groq",
  "openrouter-free",
  "openrouter-pay",
  "local",
];

export interface ModelPickerSection {
  id: "recent" | ProviderId;
  /** Provider label for provider groups; the UI translates the "recent" group. */
  label: string;
  models: SelectableModel[];
}

export interface BuildSectionsOptions {
  recentIds: readonly string[];
  query: string;
  filter: ModelFilter;
  isLocalVisible: boolean;
  /** Translated description used for search. */
  describe: (model: SelectableModel) => string;
}

/** Lowercase and strip Vietnamese/Latin diacritics so "gémini" matches "Gemini". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function matchesFilter(model: SelectableModel, filter: ModelFilter): boolean {
  switch (filter) {
    case "fast":
      return model.category === "low-latency";
    case "reasoning":
      return model.category === "reasoning";
    case "free":
      return model.providerId === "openrouter-free";
    case "local":
      return model.providerId === "local";
    default:
      return true;
  }
}

function matchesQuery(
  model: SelectableModel,
  terms: readonly string[],
  describe: (m: SelectableModel) => string
) {
  if (terms.length === 0) return true;
  const haystack = normalizeSearchText(
    [
      model.name ?? model.id,
      model.id,
      PROVIDER_LABELS[model.providerId] ?? "",
      describe(model),
    ].join(" ")
  );
  return terms.every((term) => haystack.includes(term));
}

/** Filters, searches and groups models: "recent" first (only when browsing), then providers. */
export function buildModelPickerSections(
  models: readonly SelectableModel[],
  opts: BuildSectionsOptions
): ModelPickerSection[] {
  const terms = normalizeSearchText(opts.query).split(/\s+/).filter(Boolean);
  const visible = models.filter(
    (m) =>
      (m.providerId !== "local" || opts.isLocalVisible) &&
      matchesFilter(m, opts.filter) &&
      matchesQuery(m, terms, opts.describe)
  );

  const sections: ModelPickerSection[] = [];
  const showRecent = terms.length === 0 && opts.filter === "all";
  const recentModels = showRecent
    ? opts.recentIds
        .map((id) => visible.find((m) => m.id === id))
        .filter((m): m is SelectableModel => m !== undefined)
    : [];
  if (recentModels.length > 0) sections.push({ id: "recent", label: "", models: recentModels });

  const recentSet = new Set(recentModels.map((m) => m.id));
  for (const providerId of PROVIDER_ORDER) {
    const group = visible.filter((m) => m.providerId === providerId && !recentSet.has(m.id));
    if (group.length > 0) {
      sections.push({
        id: providerId,
        label: PROVIDER_LABELS[providerId] ?? providerId,
        models: group,
      });
    }
  }
  return sections;
}

export type ModelDisplayStatus = "current" | "legacy" | "retired";

export interface ChatModelDisplay {
  name: string;
  providerLabel: string;
  status: ModelDisplayStatus;
}

/** Display info for a stored message model id (legacy aliases map to their replacement). */
export function resolveChatModelDisplay(modelId: unknown): ChatModelDisplay {
  const raw = typeof modelId === "string" ? modelId.trim() : "";
  if (!raw) return { name: "AI", providerLabel: "AI", status: "retired" };

  const current = SELECTABLE_MODELS.find((m) => m.id === raw);
  if (current) {
    return {
      name: current.name ?? current.id,
      providerLabel: PROVIDER_LABELS[current.providerId] ?? current.providerId,
      status: "current",
    };
  }

  if (Object.hasOwn(MODEL_ALIASES, raw)) {
    const target = SELECTABLE_MODELS.find((m) => m.id === MODEL_ALIASES[raw]);
    if (target) {
      return {
        name: target.name ?? target.id,
        providerLabel: PROVIDER_LABELS[target.providerId] ?? target.providerId,
        status: "legacy",
      };
    }
  }

  return { name: raw, providerLabel: "AI", status: "retired" };
}
