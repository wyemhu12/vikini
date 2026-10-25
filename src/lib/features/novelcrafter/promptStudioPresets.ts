// /lib/features/novelcrafter/promptStudioPresets.ts
// Built-in context presets for Novelcrafter Prompt Studio (default, lean_context, deep_continuity)

import { NOVELCRAFTER_CONTEXT_NODES, type NovelcrafterContextNode } from "./contextNodes";
import {
  ALL_PROMPT_ACTION_KEYS,
  getDefaultContextNodes,
  resolveEffectiveContextNodes,
  type NovelcrafterPromptActionKey,
} from "./promptActions";
import type { PromptOverrideMap } from "./promptStudioSettings";

export const NOVELCRAFTER_BUILT_IN_PRESET_IDS = [
  "default",
  "lean_context",
  "deep_continuity",
] as const;

export type NovelcrafterBuiltInPresetId = (typeof NOVELCRAFTER_BUILT_IN_PRESET_IDS)[number];

export interface BuiltInPromptPreset {
  id: NovelcrafterBuiltInPresetId;
  overrides: PromptOverrideMap;
}

const LEAN_ALLOWED_NODES: ReadonlySet<NovelcrafterContextNode> = new Set([
  "style",
  "genre",
  "pov_tense",
  "scenes",
  "preceding_prose",
]);

const DEEP_CONTINUITY_EXTRA_NODES: readonly NovelcrafterContextNode[] = [
  "synopsis",
  "outline",
  "story_so_far",
  "previous_chapter_continuity",
];

function nodesEqual(
  a: readonly NovelcrafterContextNode[],
  b: readonly NovelcrafterContextNode[]
): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

function canonicalUnion(
  base: readonly NovelcrafterContextNode[],
  extra: readonly NovelcrafterContextNode[]
): NovelcrafterContextNode[] {
  const set = new Set<NovelcrafterContextNode>([...base, ...extra]);
  return NOVELCRAFTER_CONTEXT_NODES.filter((n) => set.has(n));
}

function buildLeanContextOverrides(): PromptOverrideMap {
  const map: PromptOverrideMap = {};
  for (const key of ALL_PROMPT_ACTION_KEYS) {
    const defaults = getDefaultContextNodes(key);
    const filtered = defaults.filter((node) => LEAN_ALLOWED_NODES.has(node));
    const effective = resolveEffectiveContextNodes(key, filtered);
    if (!nodesEqual(effective, defaults)) {
      map[key] = { contextNodes: effective };
    }
  }
  return map;
}

function isDeepContinuityTarget(key: NovelcrafterPromptActionKey): boolean {
  return (
    key.startsWith("write:") ||
    key.startsWith("feedback:") ||
    key === "bible:draft" ||
    key === "bible:scenes"
  );
}

function buildDeepContinuityOverrides(): PromptOverrideMap {
  const map: PromptOverrideMap = {};
  for (const key of ALL_PROMPT_ACTION_KEYS) {
    if (!isDeepContinuityTarget(key)) continue;
    const defaults = getDefaultContextNodes(key);
    const merged = canonicalUnion(defaults, DEEP_CONTINUITY_EXTRA_NODES);
    const effective = resolveEffectiveContextNodes(key, merged);
    if (!nodesEqual(effective, defaults)) {
      map[key] = { contextNodes: effective };
    }
  }
  return map;
}

export const BUILT_IN_PROMPT_PRESETS: Record<NovelcrafterBuiltInPresetId, BuiltInPromptPreset> = {
  default: {
    id: "default",
    overrides: {},
  },
  lean_context: {
    id: "lean_context",
    overrides: buildLeanContextOverrides(),
  },
  deep_continuity: {
    id: "deep_continuity",
    overrides: buildDeepContinuityOverrides(),
  },
};

export function isBuiltInPresetId(val: unknown): val is NovelcrafterBuiltInPresetId {
  return (
    typeof val === "string" && (NOVELCRAFTER_BUILT_IN_PRESET_IDS as readonly string[]).includes(val)
  );
}
