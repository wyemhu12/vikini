// /lib/features/novelcrafter/promptStudioSettings.ts
// Pure state, sanitization, preset management, and stream override builder for Prompt Studio

import { normalizeContextNodes, type NovelcrafterContextNode } from "./contextNodes";
import {
  getDefaultContextNodes,
  isPromptActionKey,
  resolveEffectiveContextNodes,
  type NovelcrafterPromptActionKey,
} from "./promptActions";
import { DEFAULT_PROMPT_DIRECTIVES } from "./promptDirectiveDefaults";
import { BUILT_IN_PROMPT_PRESETS, isBuiltInPresetId } from "./promptStudioPresets";
import { FIELD_MAX_LENGTHS, truncateText } from "./stateLimits";

export interface PromptActionOverride {
  directive?: string;
  contextNodes?: NovelcrafterContextNode[];
}

export type PromptOverrideMap = Partial<Record<NovelcrafterPromptActionKey, PromptActionOverride>>;

export interface PromptStudioCustomPreset {
  id: string;
  name: string;
  createdAt: number;
  overrides: PromptOverrideMap;
}

export interface PromptStudioSettings {
  overrides: PromptOverrideMap;
  customPresets: PromptStudioCustomPreset[];
  activePresetId: string | null;
}

export const MAX_CUSTOM_PROMPT_PRESETS = 20 as const;

export function createDefaultPromptStudioSettings(): PromptStudioSettings {
  return {
    overrides: {},
    customPresets: [],
    activePresetId: null,
  };
}

export function areContextNodesEqual(
  a: readonly NovelcrafterContextNode[],
  b: readonly NovelcrafterContextNode[]
): boolean {
  return a.length === b.length && a.every((node, idx) => node === b[idx]);
}

export function cloneOverrideMap(source: PromptOverrideMap): PromptOverrideMap {
  const result: PromptOverrideMap = {};
  for (const [key, val] of Object.entries(source)) {
    if (!isPromptActionKey(key) || !val) continue;
    result[key] = {
      ...(val.directive !== undefined ? { directive: val.directive } : {}),
      ...(val.contextNodes !== undefined ? { contextNodes: [...val.contextNodes] } : {}),
    };
  }
  return result;
}

export function normalizeActionOverride(
  key: NovelcrafterPromptActionKey,
  raw: unknown
): PromptActionOverride | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;

  let directive: string | undefined;
  if (typeof obj.directive === "string") {
    const clamped = truncateText(obj.directive, FIELD_MAX_LENGTHS.promptDirectiveOverride).trim();
    if (clamped.length > 0 && clamped !== DEFAULT_PROMPT_DIRECTIVES[key]) {
      directive = clamped;
    }
  }

  let contextNodes: NovelcrafterContextNode[] | undefined;
  const normalizedNodes = normalizeContextNodes(obj.contextNodes);
  if (normalizedNodes !== undefined) {
    const effective = resolveEffectiveContextNodes(key, normalizedNodes);
    const defaults = getDefaultContextNodes(key);
    if (!areContextNodesEqual(effective, defaults)) {
      contextNodes = effective;
    }
  }

  if (directive === undefined && contextNodes === undefined) {
    return undefined;
  }

  return {
    ...(directive !== undefined ? { directive } : {}),
    ...(contextNodes !== undefined ? { contextNodes } : {}),
  };
}

export function sanitizeOverrideMap(raw: unknown): PromptOverrideMap {
  if (!raw || typeof raw !== "object") return {};
  const result: PromptOverrideMap = {};
  for (const [rawKey, rawVal] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPromptActionKey(rawKey)) continue;
    const normalized = normalizeActionOverride(rawKey, rawVal);
    if (normalized) {
      result[rawKey] = normalized;
    }
  }
  return result;
}

export function sanitizePromptStudioSettings(raw: unknown): PromptStudioSettings {
  if (!raw || typeof raw !== "object") {
    return createDefaultPromptStudioSettings();
  }
  const root = raw as Record<string, unknown>;
  const overrides = sanitizeOverrideMap(root.overrides);

  const rawPresets = Array.isArray(root.customPresets) ? root.customPresets : [];
  const customPresets: PromptStudioCustomPreset[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (
    let i = 0;
    i < rawPresets.length && customPresets.length < MAX_CUSTOM_PROMPT_PRESETS;
    i += 1
  ) {
    const entry = rawPresets[i];
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = truncateText(obj.name, FIELD_MAX_LENGTHS.promptPresetName).trim();
    if (!name) continue;
    const lowerName = name.normalize("NFC").toLowerCase();
    if (seenNames.has(lowerName)) continue;

    const id = truncateText(obj.id, 100, `preset-${i + 1}`).trim() || `preset-${i + 1}`;
    if (seenIds.has(id) || isBuiltInPresetId(id)) continue;

    seenIds.add(id);
    seenNames.add(lowerName);

    const createdAt =
      typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt) && obj.createdAt >= 0
        ? Math.floor(obj.createdAt)
        : 0;

    customPresets.push({
      id,
      name,
      createdAt,
      overrides: sanitizeOverrideMap(obj.overrides),
    });
  }

  const rawActiveId = typeof root.activePresetId === "string" ? root.activePresetId.trim() : "";
  const isValidActive =
    Boolean(rawActiveId) &&
    (isBuiltInPresetId(rawActiveId) || customPresets.some((p) => p.id === rawActiveId));

  return {
    overrides,
    customPresets,
    activePresetId: isValidActive ? rawActiveId : null,
  };
}

export function setActionOverride(
  settings: PromptStudioSettings,
  key: NovelcrafterPromptActionKey,
  next: PromptActionOverride
): PromptStudioSettings {
  const normalized = normalizeActionOverride(key, next);
  const nextOverrides: PromptOverrideMap = { ...settings.overrides };
  if (normalized) {
    nextOverrides[key] = normalized;
  } else {
    delete nextOverrides[key];
  }
  return {
    ...settings,
    overrides: nextOverrides,
  };
}

export function resetActionOverride(
  settings: PromptStudioSettings,
  key: NovelcrafterPromptActionKey
): PromptStudioSettings {
  if (!settings.overrides[key]) return settings;
  const nextOverrides: PromptOverrideMap = { ...settings.overrides };
  delete nextOverrides[key];
  return {
    ...settings,
    overrides: nextOverrides,
  };
}

export function resetAllPromptOverrides(settings: PromptStudioSettings): PromptStudioSettings {
  return {
    ...settings,
    overrides: {},
    activePresetId: null,
  };
}

export type CreateCustomPresetResult =
  | { ok: true; settings: PromptStudioSettings; preset: PromptStudioCustomPreset }
  | { ok: false; code: "EMPTY_NAME" | "LIMIT_REACHED" | "DUPLICATE_NAME" };

export function createCustomPreset(
  settings: PromptStudioSettings,
  rawName: string,
  nowMs = Date.now(),
  id = `preset-${nowMs}`
): CreateCustomPresetResult {
  const name = truncateText(rawName, FIELD_MAX_LENGTHS.promptPresetName).trim();
  if (!name) {
    return { ok: false, code: "EMPTY_NAME" };
  }
  if (settings.customPresets.length >= MAX_CUSTOM_PROMPT_PRESETS) {
    return { ok: false, code: "LIMIT_REACHED" };
  }
  const normalizedName = name.normalize("NFC").toLowerCase();
  const hasDuplicate = settings.customPresets.some(
    (p) => p.name.normalize("NFC").toLowerCase() === normalizedName
  );
  if (hasDuplicate) {
    return { ok: false, code: "DUPLICATE_NAME" };
  }

  const preset: PromptStudioCustomPreset = {
    id,
    name,
    createdAt: Math.max(0, Math.floor(nowMs)),
    overrides: cloneOverrideMap(settings.overrides),
  };

  return {
    ok: true,
    preset,
    settings: {
      ...settings,
      customPresets: [...settings.customPresets, preset],
      activePresetId: preset.id,
    },
  };
}

export function deleteCustomPreset(
  settings: PromptStudioSettings,
  presetId: string
): PromptStudioSettings {
  const nextCustom = settings.customPresets.filter((p) => p.id !== presetId);
  if (nextCustom.length === settings.customPresets.length) {
    return settings;
  }
  return {
    ...settings,
    customPresets: nextCustom,
    activePresetId: settings.activePresetId === presetId ? null : settings.activePresetId,
  };
}

export function applyPreset(
  settings: PromptStudioSettings,
  presetId: string
): PromptStudioSettings {
  if (isBuiltInPresetId(presetId)) {
    const builtIn = BUILT_IN_PROMPT_PRESETS[presetId];
    return {
      ...settings,
      overrides: cloneOverrideMap(builtIn.overrides),
      activePresetId: presetId,
    };
  }
  const found = settings.customPresets.find((p) => p.id === presetId);
  if (!found) {
    return settings;
  }
  return {
    ...settings,
    overrides: cloneOverrideMap(found.overrides),
    activePresetId: found.id,
  };
}

export interface StreamPromptOverridePayload {
  promptDirectiveOverride?: string;
  contextNodes?: NovelcrafterContextNode[];
}

export function buildStreamPromptOverridePayload(
  key: NovelcrafterPromptActionKey | null,
  settings: PromptStudioSettings
): StreamPromptOverridePayload {
  if (!key) return {};
  const entry = settings.overrides[key];
  if (!entry) return {};
  return {
    ...(entry.directive ? { promptDirectiveOverride: entry.directive } : {}),
    ...(entry.contextNodes ? { contextNodes: [...entry.contextNodes] } : {}),
  };
}
