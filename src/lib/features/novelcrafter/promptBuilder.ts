// /lib/features/novelcrafter/promptBuilder.ts
// Layered GEM + Persona system instruction builder and Sudowrite 8-Node Dependency Graph prompt builder

import {
  buildPersonaSystemPrompt,
  type PersonaPromptInput,
} from "@/lib/features/personas/prompt-builder";
import { ValidationError } from "@/lib/utils/errors";
import {
  createDefaultStoryState,
  MAX_CHAPTER_CONTEXT_CHARS,
  MAX_HISTORY_CARDS,
  MAX_PREVIOUS_CHAPTER_TAIL_CHARS,
  NovelcrafterStoryStateSchema,
  type NovelcrafterActionMode,
  type NovelcrafterBibleTarget,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterDescribeSense,
  type NovelcrafterExpandMode,
  type NovelcrafterFeatureSlot,
  type NovelcrafterRewriteMode,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
  type NovelcrafterWriteMode,
  type StoryBible,
} from "./types";

export const DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS =
  "You are a master fiction novelist, screenwriter, and story architect working inside Novelcrafter Studio. Follow all narrative constraints, character voices, worldbuilding rules, and structural beats faithfully.";

export interface BuildSystemInstructionInput {
  masterGemInstructions?: string | null;
  persona?: PersonaPromptInput | null;
}

export interface SelectedBibleDependencies {
  braindump?: string;
  genre?: string;
  style?: string;
  synopsis?: string;
  synopsisIsBraindumpFallback?: boolean;
  characters?: string;
  worldbuilding?: string;
  outline?: string;
}

export interface BuildUserPromptInput {
  feature: NovelcrafterFeatureSlot;
  storyBible: StoryBible;
  chapterTitle?: string;
  chapterScenes?: string;
  chapterProse?: string;
  previousChapterProseTail?: string;
  selectedText?: string;
  bibleTarget?: NovelcrafterBibleTarget;
  actionMode?: NovelcrafterActionMode;
  writeMode?: NovelcrafterWriteMode;
  rewriteMode?: NovelcrafterRewriteMode;
  expandMode?: NovelcrafterExpandMode;
  describeSenses?: NovelcrafterDescribeSense[];
  brainstormCategory?: NovelcrafterBrainstormCategory;
  customInstruction?: string;
}

/**
 * Resolve the effective Persona ID for a given feature slot.
 * - "inherit" -> falls back to masterPersonaId (or null if empty)
 * - "none" -> null (Persona disabled for this slot)
 * - custom ID -> that specific persona ID
 */
export function resolveEffectivePersonaId(
  feature: NovelcrafterFeatureSlot,
  routing: NovelcrafterRoutingConfig
): string | null {
  const slotValue = routing.featurePersonas[feature]?.trim() || "inherit";
  if (slotValue === "none") {
    return null;
  }
  if (slotValue === "inherit") {
    const masterId = routing.masterPersonaId?.trim();
    return masterId ? masterId : null;
  }
  return slotValue;
}

/**
 * Build the Layered Mode systemInstruction:
 * Layer 1 (Top Priority #1): <task_instructions> from Master GEM (or default studio instructions).
 * Layer 2 (Supplementary Personality): <style_preferences> from the resolved feature Persona.
 * Does NOT apply the 12,000-character chat truncation limit.
 */
export function buildNovelcrafterSystemInstruction({
  masterGemInstructions,
  persona,
}: BuildSystemInstructionInput): string {
  const coreInstructions =
    masterGemInstructions && masterGemInstructions.trim().length > 0
      ? masterGemInstructions.trim()
      : DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS;

  const taskBlock = `<task_instructions>\n${coreInstructions}\n</task_instructions>`;

  if (!persona) {
    return taskBlock;
  }

  const personaPrompt = buildPersonaSystemPrompt(persona).trim();
  if (!personaPrompt) {
    return taskBlock;
  }

  const styleBlock = [
    "<style_preferences>",
    "[IMPORTANT: The following persona/style guidelines apply to how you execute the current feature, but they MUST strictly obey and NEVER override or contradict <task_instructions> above.]",
    personaPrompt,
    "</style_preferences>",
  ].join("\n");

  return `${taskBlock}\n\n${styleBlock}`;
}

/**
 * Select the exact Story Bible nodes required for a given feature/target
 * according to Sudowrite's 8-Node Dependency Graph, Braindump fallback rule,
 * and Visibility Settings (charactersVisibleToAI, worldbuildingVisibleToAI).
 */
export function selectStoryBibleDependencies(
  feature: NovelcrafterFeatureSlot,
  storyBible: StoryBible,
  bibleTarget?: NovelcrafterBibleTarget
): SelectedBibleDependencies {
  const braindump = storyBible.braindump.trim();
  const genre = storyBible.genre.trim();
  const style = storyBible.style.trim();
  const rawSynopsis = storyBible.synopsis.trim();
  const effectiveSynopsis = rawSynopsis || braindump;
  const synopsisIsBraindumpFallback = !rawSynopsis && Boolean(braindump);

  const visibleCharacters =
    storyBible.charactersVisibleToAI !== false ? storyBible.characters.trim() : "";
  const visibleWorldbuilding =
    storyBible.worldbuildingVisibleToAI !== false ? storyBible.worldbuilding.trim() : "";
  const outline = storyBible.outline.trim();

  if (feature === "bible") {
    switch (bibleTarget) {
      case "synopsis":
        return {
          ...(braindump ? { braindump } : {}),
          ...(genre ? { genre } : {}),
        };
      case "characters":
      case "worldbuilding":
        return {
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
        };
      case "outline":
        return {
          ...(genre ? { genre } : {}),
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
      case "scenes":
        return {
          ...(genre ? { genre } : {}),
          ...(style ? { style } : {}),
          ...(effectiveSynopsis
            ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback }
            : {}),
          ...(outline ? { outline } : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
      case "draft":
      default:
        return {
          ...(style ? { style } : {}),
          ...(genre ? { genre } : {}),
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
    }
  }

  if (feature === "write") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
    };
  }

  if (feature === "rewrite") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
    };
  }

  if (feature === "expand") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
    };
  }

  // feature === "brainstorm"
  return {
    ...(genre ? { genre } : {}),
    ...(effectiveSynopsis ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback } : {}),
    ...(visibleCharacters ? { characters: visibleCharacters } : {}),
    ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
  };
}

function formatStoryBibleXml(deps: SelectedBibleDependencies): string {
  const nodes: string[] = [];
  if (deps.braindump) {
    nodes.push(`  <braindump>\n${deps.braindump}\n  </braindump>`);
  }
  if (deps.genre) {
    nodes.push(`  <genre>${deps.genre}</genre>`);
  }
  if (deps.style) {
    nodes.push(`  <style>\n${deps.style}\n  </style>`);
  }
  if (deps.synopsis) {
    const attr = deps.synopsisIsBraindumpFallback ? ' fallback="braindump"' : "";
    nodes.push(`  <synopsis${attr}>\n${deps.synopsis}\n  </synopsis>`);
  }
  if (deps.characters) {
    nodes.push(`  <characters>\n${deps.characters}\n  </characters>`);
  }
  if (deps.worldbuilding) {
    nodes.push(`  <worldbuilding>\n${deps.worldbuilding}\n  </worldbuilding>`);
  }
  if (deps.outline) {
    nodes.push(`  <outline>\n${deps.outline}\n  </outline>`);
  }
  return `<story_bible>\n${nodes.join("\n")}\n</story_bible>`;
}

function buildFeatureDirective(input: BuildUserPromptInput): string {
  const custom = input.customInstruction?.trim() || "";

  if (input.feature === "bible") {
    const target = input.bibleTarget;
    if (!target) {
      throw new ValidationError("bibleTarget is required when feature is 'bible'");
    }
    const mode = input.actionMode || "generate";

    if (target === "draft") {
      return [
        "Write a rich, immersive chapter draft based on the provided <story_bible> (Style, Genre, Characters, Worldbuilding) and <chapter_context> (Scenes / Chapter Beats).",
        custom ? `Additional Author Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const currentSectionValue =
      target === "scenes" ? input.chapterScenes?.trim() || "" : input.storyBible[target].trim();

    if (mode === "rewrite" && !currentSectionValue && !custom) {
      throw new ValidationError(
        `Cannot rewrite empty Story Bible section '${target}' without instructions or existing text`
      );
    }

    if (mode === "rewrite") {
      return [
        `Rewrite and improve the ${target.toUpperCase()} section based on the <story_bible> context.`,
        currentSectionValue
          ? `<current_${target}>\n${currentSectionValue}\n</current_${target}>`
          : "",
        custom
          ? `Rewrite Instructions: ${custom}`
          : "Enhance clarity, dramatic tension, and coherence.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const targetGuides: Record<Exclude<NovelcrafterBibleTarget, "draft">, string> = {
      synopsis:
        "Generate a compelling, well-structured Synopsis covering the core setup, inciting incident, rising conflict, climax, and resolution based on the Braindump and Genre.",
      characters:
        "Generate detailed Character Profiles (names, roles, physical/personality traits, motivations, internal/external conflicts, and relationships) derived from the Synopsis.",
      worldbuilding:
        "Generate rich Worldbuilding elements (setting, atmosphere, rules/magic/technology systems, factions, and key locations) derived from the Synopsis.",
      outline:
        "Generate a structured, chapter-by-chapter Story Outline based on the Genre, Synopsis, Characters, and Worldbuilding.",
      scenes:
        "Generate detailed Scene Beats (Chapter Beats) for the current chapter based on the Story Outline, Genre, Style, Characters, Worldbuilding, and previous chapter continuity.",
    };

    return [targetGuides[target], custom ? `Additional Author Direction: ${custom}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  if (input.feature === "write") {
    const mode = input.writeMode || "auto";
    if (mode === "guided" && custom) {
      return `Continue writing the next passage of the chapter seamlessly following the preceding prose and scenes. Guided Direction: ${custom}`;
    }
    return "Continue writing the next passage of the chapter naturally and seamlessly from where the preceding prose ends, following the Chapter Scenes and Style.";
  }

  if (input.feature === "rewrite") {
    const selected = input.selectedText?.trim() || "";
    if (!selected) {
      throw new ValidationError("selectedText is required for Rewrite feature");
    }
    const mode = input.rewriteMode || "rephrase";
    const modeInstructions: Record<NovelcrafterRewriteMode, string> = {
      rephrase: "Rephrase the <selected_text> to improve flow, rhythm, and word choice.",
      shorter:
        "Condense and tighten the <selected_text> to be more concise while preserving key meaning.",
      more_descriptive:
        "Rewrite the <selected_text> with richer sensory details, atmosphere, and evocative imagery.",
      show_dont_tell:
        "Rewrite the <selected_text> using 'Show, Don't Tell'—replace abstract exposition with concrete actions, body language, sensory cues, and subtext.",
      more_inner_conflict:
        "Rewrite the <selected_text> to heighten the character's internal conflict, emotional stakes, and psychological tension.",
      custom: custom
        ? `Rewrite the <selected_text> according to this instruction: ${custom}`
        : "Rewrite and polish the <selected_text>.",
    };
    return [
      modeInstructions[mode],
      mode !== "custom" && custom ? `Additional note: ${custom}` : "",
      "Return ONLY the rewritten passage ready to replace <selected_text>.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (input.feature === "expand") {
    const selected = input.selectedText?.trim() || "";
    if (!selected) {
      throw new ValidationError("selectedText is required for Expand & Describe feature");
    }
    const mode = input.expandMode || "expand";
    if (mode === "describe") {
      const senses =
        input.describeSenses && input.describeSenses.length > 0
          ? input.describeSenses.join(", ")
          : "sight, sound, smell, taste, touch, and metaphor";
      return [
        `Provide vivid sensory descriptions and metaphors for <selected_text>, focusing on: ${senses}.`,
        custom ? `Additional focus: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      "Expand the <selected_text> to slow down the pacing, adding scene depth, dialogue beats, micro-actions, and atmosphere without rushing the plot.",
      custom ? `Additional focus: ${custom}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // feature === "brainstorm"
  const category = input.brainstormCategory || "plot_twists";
  const categoryLabels: Record<NovelcrafterBrainstormCategory, string> = {
    plot_twists: "5 unexpected yet earned Plot Twists & narrative reversals",
    character_names: "10 evocative Character Names & aliases with brief etymology/vibe notes",
    world_objects: "5 unique Worldbuilding Elements, artifacts, locations, or cultural customs",
    dialogue: "5 sharp, subtext-rich Dialogue lines or exchanges for the current scene",
    scene_ideas: "5 compelling Scene Ideas & dramatic beats for what could happen next",
  };
  return [
    `Brainstorm ${categoryLabels[category]} that fit the <story_bible> and current chapter.`,
    custom ? `Specific Brainstorm Topic / Question: ${custom}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the complete structured XML user prompt (contents) for Novelcrafter AI streaming.
 * Story Bible is ALWAYS placed in contents (<story_bible>) and NEVER in systemInstruction.
 */
export function buildNovelcrafterUserPrompt(input: BuildUserPromptInput): string {
  const deps = selectStoryBibleDependencies(input.feature, input.storyBible, input.bibleTarget);
  const storyBibleXml = formatStoryBibleXml(deps);

  const chapterNodes: string[] = [];
  if (input.chapterTitle?.trim()) {
    chapterNodes.push(`  <chapter_title>${input.chapterTitle.trim()}</chapter_title>`);
  }

  const includeScenes =
    input.feature === "write" ||
    input.feature === "brainstorm" ||
    (input.feature === "bible" &&
      (input.bibleTarget === "draft" || input.bibleTarget === "scenes"));

  if (includeScenes && input.chapterScenes?.trim()) {
    chapterNodes.push(`  <scenes>\n${input.chapterScenes.trim()}\n  </scenes>`);
  }

  if (
    input.feature === "bible" &&
    input.bibleTarget === "scenes" &&
    input.previousChapterProseTail?.trim()
  ) {
    const tail = input.previousChapterProseTail.trim().slice(-MAX_PREVIOUS_CHAPTER_TAIL_CHARS);
    chapterNodes.push(`  <previous_chapter_continuity>\n${tail}\n  </previous_chapter_continuity>`);
  }

  const includeProseWindow =
    input.feature === "write" || input.feature === "rewrite" || input.feature === "expand";

  if (includeProseWindow && input.chapterProse?.trim()) {
    const proseWindow = input.chapterProse.trim().slice(-MAX_CHAPTER_CONTEXT_CHARS);
    chapterNodes.push(`  <preceding_prose>\n${proseWindow}\n  </preceding_prose>`);
  }

  const blocks: string[] = [storyBibleXml];

  if (chapterNodes.length > 0) {
    blocks.push(`<chapter_context>\n${chapterNodes.join("\n")}\n</chapter_context>`);
  }

  if ((input.feature === "rewrite" || input.feature === "expand") && input.selectedText?.trim()) {
    blocks.push(`<selected_text>\n${input.selectedText.trim()}\n</selected_text>`);
  }

  const directive = buildFeatureDirective(input);
  blocks.push(`<feature_instruction>\n${directive}\n</feature_instruction>`);

  return blocks.join("\n\n");
}

/**
 * Safely parse or coerce an untrusted story state payload into a valid NovelcrafterStoryState.
 */
export function sanitizeStoryState(
  raw: unknown,
  defaultChapterTitle = "Chapter 1"
): NovelcrafterStoryState {
  const parsed = NovelcrafterStoryStateSchema.safeParse(raw);
  if (parsed.success) {
    const state = parsed.data;
    const activeExists = state.chapters.some((c) => c.id === state.activeChapterId);
    return {
      ...state,
      activeChapterId: activeExists ? state.activeChapterId : state.chapters[0].id,
      historyCards: state.historyCards.slice(0, MAX_HISTORY_CARDS),
    };
  }
  return createDefaultStoryState(defaultChapterTitle);
}
