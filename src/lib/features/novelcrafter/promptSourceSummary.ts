// /lib/features/novelcrafter/promptSourceSummary.ts
// Pure resolver computing active Story Bible, Chapter Context, and fixed input sources for any Novelcrafter AI action

import type { NovelcrafterContextNode } from "./contextNodes";
import {
  isPromptActionKey,
  resolveEffectiveContextNodes,
  type NovelcrafterPromptActionKey,
} from "./promptActions";
import type { PromptStudioSettings } from "./promptStudioSettings";
import type { NovelcrafterActionMode, NovelcrafterBibleTarget } from "./types";

export const STORY_BIBLE_CONTEXT_NODES: readonly NovelcrafterContextNode[] = [
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "pov_tense",
] as const;

export const CHAPTER_CONTEXT_NODES: readonly NovelcrafterContextNode[] = [
  "story_so_far",
  "scenes",
  "previous_chapter_continuity",
  "preceding_prose",
] as const;

const STORY_BIBLE_SET: ReadonlySet<NovelcrafterContextNode> = new Set(STORY_BIBLE_CONTEXT_NODES);
const CHAPTER_CONTEXT_SET: ReadonlySet<NovelcrafterContextNode> = new Set(CHAPTER_CONTEXT_NODES);

export type PromptFixedInputKind =
  | "braindump"
  | "current_section"
  | "selected_text"
  | "guided_notes";

export interface PromptSourceSummary {
  actionKey: NovelcrafterPromptActionKey;
  actionMode?: NovelcrafterActionMode;
  storyBibleNodes: NovelcrafterContextNode[];
  chapterContextNodes: NovelcrafterContextNode[];
  fixedInputs: PromptFixedInputKind[];
  isCustomized: boolean;
  hasCustomDirective: boolean;
  hasCustomContextNodes: boolean;
  effectiveNodes: NovelcrafterContextNode[];
}

export interface ResolvePromptSourceSummaryOptions {
  actionMode?: NovelcrafterActionMode;
  bibleTarget?: NovelcrafterBibleTarget;
}

function resolveFixedInputs(
  actionKey: NovelcrafterPromptActionKey,
  actionMode?: NovelcrafterActionMode
): PromptFixedInputKind[] {
  const fixed: PromptFixedInputKind[] = [];
  if (actionKey.startsWith("bible:")) {
    if (actionMode === "rewrite") {
      fixed.push("current_section");
    } else if (actionKey === "bible:synopsis") {
      fixed.push("braindump");
    }
    return fixed;
  }

  if (actionKey === "write:guided") {
    fixed.push("guided_notes");
    return fixed;
  }

  if (actionKey.startsWith("rewrite:") || actionKey.startsWith("expand:")) {
    fixed.push("selected_text");
    return fixed;
  }

  return fixed;
}

export function resolvePromptSourceSummary(
  actionKey: NovelcrafterPromptActionKey,
  settings?: PromptStudioSettings | null,
  options?: ResolvePromptSourceSummaryOptions
): PromptSourceSummary {
  const actionMode = options?.actionMode;

  if (!isPromptActionKey(actionKey)) {
    return {
      actionKey: "write:auto",
      actionMode,
      storyBibleNodes: [],
      chapterContextNodes: [],
      fixedInputs: [],
      isCustomized: false,
      hasCustomDirective: false,
      hasCustomContextNodes: false,
      effectiveNodes: [],
    };
  }

  const overridesMap =
    settings &&
    typeof settings === "object" &&
    settings.overrides &&
    typeof settings.overrides === "object"
      ? settings.overrides
      : undefined;
  const override = overridesMap ? overridesMap[actionKey] : undefined;

  const hasCustomDirective = Boolean(
    override && typeof override.directive === "string" && override.directive.trim().length > 0
  );
  const hasCustomContextNodes = Boolean(override && Array.isArray(override.contextNodes));
  const isCustomized = hasCustomDirective || hasCustomContextNodes;

  const effectiveNodes = resolveEffectiveContextNodes(
    actionKey,
    hasCustomContextNodes ? override?.contextNodes : undefined
  );

  const storyBibleNodes = effectiveNodes.filter((node) => STORY_BIBLE_SET.has(node));
  const chapterContextNodes = effectiveNodes.filter((node) => CHAPTER_CONTEXT_SET.has(node));
  const fixedInputs = resolveFixedInputs(actionKey, actionMode);

  return {
    actionKey,
    actionMode,
    storyBibleNodes,
    chapterContextNodes,
    fixedInputs,
    isCustomized,
    hasCustomDirective,
    hasCustomContextNodes,
    effectiveNodes,
  };
}
