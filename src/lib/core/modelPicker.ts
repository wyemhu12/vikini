// Pure model-picker logic: filters, search, sections (recent + per provider) and display names.

import {
  MODEL_ALIASES,
  SELECTABLE_MODELS,
  UI_GROUP_LABELS,
  type ModelUiGroup,
  type SelectableModel,
} from "@/lib/core/modelRegistry";

export const MODEL_FILTERS = ["all", "fast", "reasoning", "free", "local"] as const;
export type ModelFilter = (typeof MODEL_FILTERS)[number];

export type ProviderId = SelectableModel["providerId"];

/** Brand-based UI group order in the picker (Gemini first). */
export const UI_GROUP_ORDER: readonly ModelUiGroup[] = [
  "gemini",
  "anthropic",
  "deepseek",
  "grok",
  "glm",
  "groq",
  "local",
];

/** Format token count as compact context string (e.g. 1048576 -> "1M", 131072 -> "131K", 32768 -> "32K"). */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens < 65_536) return `${Math.floor(tokens / 1024)}K`;
  return `${Math.floor(tokens / 1000)}K`;
}

export interface ModelPickerSection {
  id: "recent" | ModelUiGroup;
  /** Group label for brand groups; the UI translates the "recent" group. */
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
    .replace(/[\u0300-\u036f]/g, "")
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
      return model.isFree === true;
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
    [model.name ?? model.id, model.id, UI_GROUP_LABELS[model.uiGroup] ?? "", describe(model)].join(
      " "
    )
  );
  return terms.every((term) => haystack.includes(term));
}

/** Filters, searches and groups models: "recent" first (only when browsing), then brand UI groups. */
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
  for (const uiGroup of UI_GROUP_ORDER) {
    const group = visible.filter((m) => m.uiGroup === uiGroup && !recentSet.has(m.id));
    if (group.length > 0) {
      sections.push({
        id: uiGroup,
        label: UI_GROUP_LABELS[uiGroup] ?? uiGroup,
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
      providerLabel: UI_GROUP_LABELS[current.uiGroup] ?? current.uiGroup,
      status: "current",
    };
  }

  if (Object.hasOwn(MODEL_ALIASES, raw)) {
    const target = SELECTABLE_MODELS.find((m) => m.id === MODEL_ALIASES[raw]);
    if (target) {
      return {
        name: target.name ?? target.id,
        providerLabel: UI_GROUP_LABELS[target.uiGroup] ?? target.uiGroup,
        status: "legacy",
      };
    }
  }

  return { name: raw, providerLabel: "AI", status: "retired" };
}
