// /lib/features/novelcrafter/promptActions.ts
// Action keys, group catalog, and default/required context node rules for Novelcrafter Prompt Studio

import { NOVELCRAFTER_CONTEXT_NODES, type NovelcrafterContextNode } from "./contextNodes";
import {
  NOVELCRAFTER_BIBLE_TARGETS,
  NOVELCRAFTER_BRAINSTORM_CATEGORIES,
  NOVELCRAFTER_EXPAND_MODES,
  NOVELCRAFTER_FEEDBACK_MODES,
  NOVELCRAFTER_REWRITE_MODES,
  NOVELCRAFTER_WRITE_MODES,
  type NovelcrafterBibleTarget,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterExpandMode,
  type NovelcrafterFeatureSlot,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterWriteMode,
} from "./types";

export type NovelcrafterPromptActionKey =
  | `bible:${NovelcrafterBibleTarget}`
  | `write:${NovelcrafterWriteMode}`
  | `rewrite:${NovelcrafterRewriteMode}`
  | `feedback:${NovelcrafterFeedbackMode}`
  | `expand:${NovelcrafterExpandMode}`
  | `brainstorm:${NovelcrafterBrainstormCategory}`;

export interface PromptActionGroup {
  feature: NovelcrafterFeatureSlot;
  keys: readonly NovelcrafterPromptActionKey[];
}

export const PROMPT_ACTION_GROUPS: readonly PromptActionGroup[] = [
  {
    feature: "bible",
    keys: NOVELCRAFTER_BIBLE_TARGETS.map((t) => `bible:${t}` as const),
  },
  {
    feature: "write",
    keys: NOVELCRAFTER_WRITE_MODES.map((m) => `write:${m}` as const),
  },
  {
    feature: "rewrite",
    keys: NOVELCRAFTER_REWRITE_MODES.map((m) => `rewrite:${m}` as const),
  },
  {
    feature: "feedback",
    keys: NOVELCRAFTER_FEEDBACK_MODES.map((m) => `feedback:${m}` as const),
  },
  {
    feature: "expand",
    keys: NOVELCRAFTER_EXPAND_MODES.map((m) => `expand:${m}` as const),
  },
  {
    feature: "brainstorm",
    keys: NOVELCRAFTER_BRAINSTORM_CATEGORIES.map((c) => `brainstorm:${c}` as const),
  },
] as const;

export const ALL_PROMPT_ACTION_KEYS: readonly NovelcrafterPromptActionKey[] =
  PROMPT_ACTION_GROUPS.flatMap((group) => group.keys);

const ACTION_KEY_SET: ReadonlySet<string> = new Set(ALL_PROMPT_ACTION_KEYS);

export function isPromptActionKey(val: unknown): val is NovelcrafterPromptActionKey {
  return typeof val === "string" && ACTION_KEY_SET.has(val);
}

export interface PromptActionSelector {
  feature: NovelcrafterFeatureSlot;
  bibleTarget?: NovelcrafterBibleTarget;
  writeMode?: NovelcrafterWriteMode;
  rewriteMode?: NovelcrafterRewriteMode;
  feedbackMode?: NovelcrafterFeedbackMode;
  expandMode?: NovelcrafterExpandMode;
  brainstormCategory?: NovelcrafterBrainstormCategory;
}

export function resolvePromptActionKey(
  selector: PromptActionSelector
): NovelcrafterPromptActionKey | null {
  switch (selector.feature) {
    case "bible":
      return selector.bibleTarget ? `bible:${selector.bibleTarget}` : null;
    case "write":
      return `write:${selector.writeMode ?? "auto"}`;
    case "rewrite":
      return `rewrite:${selector.rewriteMode ?? "rephrase"}`;
    case "feedback":
      return `feedback:${selector.feedbackMode ?? "developmental"}`;
    case "expand":
      return `expand:${selector.expandMode ?? "expand"}`;
    case "brainstorm":
      return `brainstorm:${selector.brainstormCategory ?? "plot_twists"}`;
  }
}

function canonicalize(nodes: readonly NovelcrafterContextNode[]): NovelcrafterContextNode[] {
  const set = new Set(nodes);
  return NOVELCRAFTER_CONTEXT_NODES.filter((n) => set.has(n));
}

const WRITE_BASE_NODES = canonicalize([
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
  "story_so_far",
  "scenes",
  "previous_chapter_continuity",
  "preceding_prose",
]);

const WRITE_ROUGH_DRAFT_NODES = canonicalize(["synopsis", "outline", ...WRITE_BASE_NODES]);

const REWRITE_NODES = canonicalize(["style", "genre", "pov_tense", "preceding_prose"]);

const FEEDBACK_NODES = canonicalize([
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
  "story_so_far",
  "scenes",
  "preceding_prose",
]);

const EXPAND_NODES = canonicalize([
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
  "preceding_prose",
]);

const BRAINSTORM_NODES = canonicalize([
  "synopsis",
  "characters",
  "worldbuilding",
  "genre",
  "story_so_far",
  "scenes",
]);

const BIBLE_DEFAULT_NODES: Record<NovelcrafterBibleTarget, readonly NovelcrafterContextNode[]> = {
  synopsis: canonicalize(["genre"]),
  characters: canonicalize(["synopsis"]),
  worldbuilding: canonicalize(["synopsis"]),
  outline: canonicalize(["synopsis", "characters", "worldbuilding", "genre", "pov_tense"]),
  scenes: canonicalize([
    "synopsis",
    "outline",
    "characters",
    "worldbuilding",
    "style",
    "genre",
    "pov_tense",
    "story_so_far",
    "scenes",
    "previous_chapter_continuity",
  ]),
  chapter_summary: canonicalize([
    "synopsis",
    "characters",
    "worldbuilding",
    "genre",
    "pov_tense",
    "scenes",
    "preceding_prose",
  ]),
  draft: canonicalize([
    "synopsis",
    "outline",
    "characters",
    "worldbuilding",
    "style",
    "genre",
    "pov_tense",
    "story_so_far",
    "scenes",
  ]),
};

export function getDefaultContextNodes(
  key: NovelcrafterPromptActionKey
): readonly NovelcrafterContextNode[] {
  if (key.startsWith("bible:")) {
    const target = key.slice("bible:".length) as NovelcrafterBibleTarget;
    return BIBLE_DEFAULT_NODES[target];
  }
  if (key === "write:first_draft_rough") {
    return WRITE_ROUGH_DRAFT_NODES;
  }
  if (key.startsWith("write:")) {
    return WRITE_BASE_NODES;
  }
  if (key.startsWith("rewrite:")) {
    return REWRITE_NODES;
  }
  if (key.startsWith("feedback:")) {
    return FEEDBACK_NODES;
  }
  if (key.startsWith("expand:")) {
    return EXPAND_NODES;
  }
  return BRAINSTORM_NODES;
}

const EMPTY_NODES: readonly NovelcrafterContextNode[] = [];
const CHAPTER_SUMMARY_REQUIRED: readonly NovelcrafterContextNode[] = ["scenes", "preceding_prose"];
const PROSE_REQUIRED: readonly NovelcrafterContextNode[] = ["preceding_prose"];

export function getRequiredContextNodes(
  key: NovelcrafterPromptActionKey
): readonly NovelcrafterContextNode[] {
  if (key === "bible:chapter_summary") {
    return CHAPTER_SUMMARY_REQUIRED;
  }
  if (key === "write:auto" || key === "write:guided" || key === "write:tone_shift") {
    return PROSE_REQUIRED;
  }
  if (key.startsWith("feedback:")) {
    return PROSE_REQUIRED;
  }
  return EMPTY_NODES;
}

export function resolveEffectiveContextNodes(
  key: NovelcrafterPromptActionKey,
  override?: readonly NovelcrafterContextNode[]
): NovelcrafterContextNode[] {
  if (override === undefined) {
    return [...getDefaultContextNodes(key)];
  }
  const required = getRequiredContextNodes(key);
  return canonicalize([...override, ...required]);
}
