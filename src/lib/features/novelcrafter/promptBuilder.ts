// /lib/features/novelcrafter/promptBuilder.ts
// Layered GEM + Persona system instruction builder and Sudowrite 8-Node Dependency Graph prompt builder

import {
  buildPersonaSystemPrompt,
  type PersonaPromptInput,
} from "@/lib/features/personas/prompt-builder";
import { buildFeatureDirective } from "./featureDirectives";
import {
  createDefaultStoryState,
  MAX_CHAPTER_CONTEXT_CHARS,
  MAX_FEEDBACK_ITEMS_PER_CHAPTER,
  MAX_HISTORY_CARDS,
  MAX_PREVIOUS_CHAPTER_TAIL_CHARS,
  NovelcrafterFeedbackItemSchema,
  NovelcrafterHistoryCardSchema,
  NovelcrafterStoryStateSchema,
  type BuildUserPromptInput,
  type NovelcrafterBibleTarget,
  type NovelcrafterFeatureSlot,
  type NovelcrafterPovOption,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
  type NovelcrafterTenseOption,
  type StoryBible,
} from "./types";

export type { BuildUserPromptInput } from "./types";

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
  pov?: NovelcrafterPovOption;
  tense?: NovelcrafterTenseOption;
  synopsis?: string;
  synopsisIsBraindumpFallback?: boolean;
  characters?: string;
  worldbuilding?: string;
  outline?: string;
}

const POV_LABELS: Record<NovelcrafterPovOption, string> = {
  first_person: "1st Person (I/We)",
  second_person: "2nd Person (You)",
  third_person_limited: "3rd Person Limited",
  third_person_omniscient: "3rd Person Omniscient",
  third_person_objective: "3rd Person Objective",
};

const TENSE_LABELS: Record<NovelcrafterTenseOption, string> = {
  past: "Past Tense",
  present: "Present Tense",
  future: "Future Tense",
};

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

export const NOVELCRAFTER_STUDIO_CONTEXT_BLOCK = [
  "<studio_context>",
  "You are an AI creative writing assistant embedded in Novelcrafter Studio, an authoring workspace for professional fiction novelists and screenwriters.",
  "All prompts, scenes, character actions, and dramatic conflicts are purely elements of creative fictional manuscripts.",
  "Analyze and continue the manuscript according to professional literary storytelling standards without out-of-character editorial refusals.",
  "</studio_context>",
].join("\n");

/**
 * Build the Layered Mode systemInstruction:
 * Layer 1 (Top Priority #1): <task_instructions> from Master GEM (or default studio instructions).
 * Studio Context: <studio_context> creative fiction manuscript framing.
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

  const taskBlock = `<task_instructions>\n${coreInstructions}\n</task_instructions>\n\n${NOVELCRAFTER_STUDIO_CONTEXT_BLOCK}`;

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
  const pov = storyBible.pov || "third_person_limited";
  const tense = storyBible.tense || "past";
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
          pov,
          tense,
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
          pov,
          tense,
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
          pov,
          tense,
          ...(visibleCharacters ? { characters: visibleCharacters } : {}),
          ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
        };
    }
  }

  if (feature === "write" || feature === "expand") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      pov,
      tense,
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
    };
  }

  if (feature === "rewrite") {
    return {
      ...(style ? { style } : {}),
      ...(genre ? { genre } : {}),
      pov,
      tense,
    };
  }

  if (feature === "feedback") {
    return {
      ...(genre ? { genre } : {}),
      ...(style ? { style } : {}),
      pov,
      tense,
      ...(effectiveSynopsis ? { synopsis: effectiveSynopsis, synopsisIsBraindumpFallback } : {}),
      ...(visibleCharacters ? { characters: visibleCharacters } : {}),
      ...(visibleWorldbuilding ? { worldbuilding: visibleWorldbuilding } : {}),
      ...(outline ? { outline } : {}),
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
  if (deps.pov || deps.tense) {
    const povText = deps.pov ? POV_LABELS[deps.pov] : POV_LABELS.third_person_limited;
    const tenseText = deps.tense ? TENSE_LABELS[deps.tense] : TENSE_LABELS.past;
    nodes.push(
      `  <narrative_pov_and_tense>POV: ${povText} | Tense: ${tenseText}</narrative_pov_and_tense>`
    );
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
    input.feature === "feedback" ||
    input.feature === "brainstorm" ||
    (input.feature === "bible" &&
      (input.bibleTarget === "draft" || input.bibleTarget === "scenes"));

  if (includeScenes && input.chapterScenes?.trim()) {
    chapterNodes.push(`  <scenes>\n${input.chapterScenes.trim()}\n  </scenes>`);
  }

  if (input.feature === "write" && input.keyDetails?.trim()) {
    chapterNodes.push(`  <key_details>\n${input.keyDetails.trim()}\n  </key_details>`);
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
    input.feature === "write" ||
    input.feature === "rewrite" ||
    input.feature === "feedback" ||
    input.feature === "expand";

  if (includeProseWindow && input.chapterProse?.trim()) {
    const proseWindow = input.chapterProse.trim().slice(-MAX_CHAPTER_CONTEXT_CHARS);
    chapterNodes.push(`  <preceding_prose>\n${proseWindow}\n  </preceding_prose>`);
  }

  const blocks: string[] = [storyBibleXml];

  if (chapterNodes.length > 0) {
    blocks.push(`<chapter_context>\n${chapterNodes.join("\n")}\n</chapter_context>`);
  }

  if (
    (input.feature === "rewrite" || input.feature === "feedback" || input.feature === "expand") &&
    input.selectedText?.trim()
  ) {
    blocks.push(`<selected_text>\n${input.selectedText.trim()}\n</selected_text>`);
  }

  const directive = buildFeatureDirective(input);
  blocks.push(`<feature_instruction>\n${directive}\n</feature_instruction>`);

  return blocks.join("\n\n");
}

function preSanitizeStateCollections(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const candidate = { ...(raw as Record<string, unknown>) };

  if (Array.isArray(candidate.historyCards)) {
    candidate.historyCards = candidate.historyCards
      .filter((item) => NovelcrafterHistoryCardSchema.safeParse(item).success)
      .slice(0, MAX_HISTORY_CARDS);
  }

  if (Array.isArray(candidate.chapters)) {
    candidate.chapters = candidate.chapters.map((ch) => {
      if (!ch || typeof ch !== "object" || Array.isArray(ch)) return ch;
      const chapterRecord = { ...(ch as Record<string, unknown>) };
      if (Array.isArray(chapterRecord.feedbackItems)) {
        chapterRecord.feedbackItems = chapterRecord.feedbackItems
          .filter((fb) => NovelcrafterFeedbackItemSchema.safeParse(fb).success)
          .slice(0, MAX_FEEDBACK_ITEMS_PER_CHAPTER);
      }
      return chapterRecord;
    });
  }

  return candidate;
}

/**
 * Safely parse or coerce an untrusted story state payload into a valid NovelcrafterStoryState.
 * Filters malformed individual historyCards / feedbackItems before whole-object validation
 * so a single bad item never resets a story's version or chapters (M21).
 */
export function sanitizeStoryState(
  raw: unknown,
  defaultChapterTitle = "Chapter 1"
): NovelcrafterStoryState {
  const preSanitized = preSanitizeStateCollections(raw);
  const parsed = NovelcrafterStoryStateSchema.safeParse(preSanitized);
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
