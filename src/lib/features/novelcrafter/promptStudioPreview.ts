// /lib/features/novelcrafter/promptStudioPreview.ts
// Live XML Prompt Preview builder using sample Story Bible & Chapter fixtures

import { type NovelcrafterPromptActionKey } from "./promptActions";
import { buildNovelcrafterUserPrompt } from "./promptBuilder";
import type { PromptActionOverride } from "./promptStudioSettings";
import {
  createDefaultStoryState,
  type BuildUserPromptInput,
  type NovelcrafterBibleTarget,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterExpandMode,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterWriteMode,
  type StoryBible,
} from "./types";

const SAMPLE_STORY_BIBLE: StoryBible = {
  ...createDefaultStoryState().storyBible,
  braindump: "A exiled archivist discovers a clockwork city beneath the salt desert.",
  genre: "Arcane Steampunk Fantasy",
  style: "Evocative third-person prose with crisp sensory details and taut pacing.",
  pov: "third_person_limited",
  tense: "past",
  synopsis:
    "After being framed for burning the Grand Library, Lyra flees into the Glass Wastes and uncovers an ancient automaton city whose heart is failing.",
  characters:
    "### Lyra Vance (Protagonist)\nFormer royal archivist; observant, guarded, carries a brass astrolabe.",
  charactersVisibleToAI: true,
  worldbuilding:
    "### The Aetherium Deep\nA subterranean city powered by pressurized steam veins and memory crystals.",
  worldbuildingVisibleToAI: true,
  outline:
    "### Act I\n1. Chapter 1: Escape across the salt flats.\n2. Chapter 2: Descent into the Aetherium Deep.",
};

function buildSampleInputForAction(
  key: NovelcrafterPromptActionKey,
  override?: PromptActionOverride
): BuildUserPromptInput {
  const base: Omit<BuildUserPromptInput, "feature"> = {
    storyBible: SAMPLE_STORY_BIBLE,
    chapterTitle: "Chapter 2: The Brass Threshold",
    chapterScenes:
      "- Lyra pries open the sealed hatch.\n- Steam vents hiss as clockwork sentinels awaken.",
    chapterExtraInstructions: "Maintain tense atmosphere and focus on metallic sounds.",
    chapterSummary: "- Lyra crossed the salt flats and found the hidden hatch.",
    chapterProse:
      "Lyra pressed her palm against the rusted valve. Beneath the salt crust, a low mechanical heartbeat vibrated through her boots.",
    previousChapterProseTail:
      "As the sandstorm swallowed the horizon, her boot struck a ring of tarnished brass buried in the salt.",
    previousChapterSummaries:
      "### Chapter 1: Salt and Ash\n[Chapter 1: Salt and Ash]: Lyra escaped the capital with the stolen astrolabe.",
    selectedText: "Beneath the salt crust, a low mechanical heartbeat vibrated through her boots.",
    keyDetails: "The astrolabe needle glows blue near active Aetherium conduits.",
    customInstruction:
      "Highlight the contrast between the freezing desert night and the warm steam.",
    ...(override?.directive?.trim() ? { promptDirectiveOverride: override.directive.trim() } : {}),
    ...(override?.contextNodes !== undefined ? { contextNodes: [...override.contextNodes] } : {}),
  };

  if (key.startsWith("bible:")) {
    const bibleTarget = key.slice("bible:".length) as NovelcrafterBibleTarget;
    return {
      ...base,
      feature: "bible",
      bibleTarget,
      actionMode: "generate",
    };
  }
  if (key.startsWith("write:")) {
    const writeMode = key.slice("write:".length) as NovelcrafterWriteMode;
    return {
      ...base,
      feature: "write",
      writeMode,
      toneShift: "ominous",
      writeLengthWords: 600,
    };
  }
  if (key.startsWith("rewrite:")) {
    const rewriteMode = key.slice("rewrite:".length) as NovelcrafterRewriteMode;
    return {
      ...base,
      feature: "rewrite",
      rewriteMode,
    };
  }
  if (key.startsWith("feedback:")) {
    const feedbackMode = key.slice("feedback:".length) as NovelcrafterFeedbackMode;
    return {
      ...base,
      feature: "feedback",
      feedbackMode,
    };
  }
  if (key.startsWith("expand:")) {
    const expandMode = key.slice("expand:".length) as NovelcrafterExpandMode;
    return {
      ...base,
      feature: "expand",
      expandMode,
    };
  }
  const brainstormCategory = key.slice("brainstorm:".length) as NovelcrafterBrainstormCategory;
  return {
    ...base,
    feature: "brainstorm",
    brainstormCategory,
  };
}

export type PromptStudioPreviewResult = { ok: true; xml: string } | { ok: false; message: string };

export function buildPromptStudioPreview(
  key: NovelcrafterPromptActionKey,
  override?: PromptActionOverride
): PromptStudioPreviewResult {
  try {
    const input = buildSampleInputForAction(key, override);
    const xml = buildNovelcrafterUserPrompt(input);
    return { ok: true, xml };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to build preview";
    return { ok: false, message };
  }
}
