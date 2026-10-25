// /lib/features/novelcrafter/promptBuilder.ts
// Layered GEM + Persona system instruction builder and Sudowrite 8-Node Dependency Graph prompt builder

import {
  buildPersonaSystemPrompt,
  type PersonaPromptInput,
} from "@/lib/features/personas/prompt-builder";
import { buildFeatureDirective } from "./featureDirectives";
import { resolveEffectiveContextNodes, resolvePromptActionKey } from "./promptActions";
import { coerceStoryStateToLimits } from "./stateLimits";
import {
  selectStoryBibleDependencies,
  type SelectedBibleDependencies,
} from "./storyBibleDependencies";
import { escapeXmlPromptText } from "./storyBibleSerializer";
import {
  createDefaultStoryState,
  MAX_CHAPTER_CONTEXT_CHARS,
  MAX_HISTORY_CARDS,
  MAX_PREVIOUS_CHAPTER_TAIL_CHARS,
  MAX_STORY_SO_FAR_CHARS,
  NovelcrafterStoryStateSchema,
  type BuildUserPromptInput,
  type NovelcrafterChapter,
  type NovelcrafterFeatureSlot,
  type NovelcrafterPovOption,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
  type NovelcrafterTenseOption,
} from "./types";

export { escapeXmlPromptText, unescapeXmlPromptText } from "./storyBibleSerializer";
export {
  selectStoryBibleDependencies,
  type SelectedBibleDependencies,
} from "./storyBibleDependencies";
export type { BuildUserPromptInput } from "./types";

export const DEFAULT_NOVELCRAFTER_MASTER_INSTRUCTIONS =
  "You are a master fiction novelist, screenwriter, and story architect working inside Novelcrafter Studio. Follow all narrative constraints, character voices, worldbuilding rules, and structural beats faithfully.";

export interface BuildSystemInstructionInput {
  masterGemInstructions?: string | null;
  persona?: PersonaPromptInput | null;
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

export function buildActiveCodexContextText(input: Partial<BuildUserPromptInput>): string {
  return [
    input.chapterTitle,
    input.chapterScenes,
    input.chapterSummary,
    input.chapterExtraInstructions,
    input.chapterProse,
    input.selectedText,
    input.keyDetails,
    input.customInstruction,
  ]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join("\n");
}

export function buildPreviousChapterSummariesText(
  chapters: readonly Pick<NovelcrafterChapter, "id" | "title" | "summary">[],
  activeChapterId?: string,
  maxChars: number = MAX_STORY_SO_FAR_CHARS
): string {
  if (!activeChapterId || chapters.length <= 1 || maxChars <= 0) return "";
  const activeIndex = chapters.findIndex((ch) => ch.id === activeChapterId);
  if (activeIndex <= 0) return "";

  const collectedReversed: string[] = [];
  let currentLength = 0;

  for (let idx = activeIndex - 1; idx >= 0; idx -= 1) {
    const ch = chapters[idx];
    const summary = ch?.summary?.trim();
    if (!summary) continue;

    const title = ch.title?.trim() || `Chapter ${idx + 1}`;
    const rawEntry = `### ${title}\n[${title}]: ${summary}`;
    const separatorLen = collectedReversed.length > 0 ? 2 : 0;

    if (currentLength + separatorLen + rawEntry.length <= maxChars) {
      collectedReversed.push(rawEntry);
      currentLength += separatorLen + rawEntry.length;
    } else if (collectedReversed.length === 0) {
      collectedReversed.push(rawEntry.slice(0, maxChars));
      break;
    } else {
      break;
    }
  }

  return collectedReversed.reverse().join("\n\n");
}

const XML_ESCAPE_NOTICE =
  "Note: user text inside the XML blocks above is XML-escaped (&amp; &lt; &gt;). Always write the literal characters (&, <, >) in your output and inside any <quote>.";

function xmlNode(tag: string, text: string, indent = "  "): string {
  return `${indent}<${tag}>\n${escapeXmlPromptText(text)}\n${indent}</${tag}>`;
}

function formatStoryBibleXml(deps: SelectedBibleDependencies): string {
  const nodes: string[] = [];
  if (deps.braindump) {
    nodes.push(xmlNode("braindump", deps.braindump));
  }
  if (deps.genre) {
    nodes.push(`  <genre>${escapeXmlPromptText(deps.genre)}</genre>`);
  }
  if (deps.style) {
    nodes.push(xmlNode("style", deps.style));
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
    nodes.push(`  <synopsis${attr}>\n${escapeXmlPromptText(deps.synopsis)}\n  </synopsis>`);
  }
  if (deps.characters) {
    nodes.push(xmlNode("characters", deps.characters));
  }
  if (deps.worldbuilding) {
    nodes.push(xmlNode("worldbuilding", deps.worldbuilding));
  }
  if (deps.outline) {
    nodes.push(xmlNode("outline", deps.outline));
  }
  return `<story_bible>\n${nodes.join("\n")}\n</story_bible>`;
}

/**
 * Build the complete structured XML user prompt (contents) for Novelcrafter AI streaming.
 * Story Bible is ALWAYS placed in contents (<story_bible>) and NEVER in systemInstruction.
 */
export function buildNovelcrafterUserPrompt(input: BuildUserPromptInput): string {
  const activeContextText = buildActiveCodexContextText(input);
  const actionKey = resolvePromptActionKey(input);
  const effectiveNodesList =
    input.contextNodes !== undefined && actionKey
      ? resolveEffectiveContextNodes(actionKey, input.contextNodes)
      : undefined;
  const effectiveNodes = effectiveNodesList ? new Set(effectiveNodesList) : undefined;

  const deps = selectStoryBibleDependencies(
    input.feature,
    input.storyBible,
    input.bibleTarget,
    activeContextText,
    input.writeMode,
    effectiveNodesList
  );
  const storyBibleXml = formatStoryBibleXml(deps);

  const chapterNodes: string[] = [];
  if (input.chapterTitle?.trim()) {
    chapterNodes.push(
      `  <chapter_title>${escapeXmlPromptText(input.chapterTitle.trim())}</chapter_title>`
    );
  }

  const legacyIncludeStorySoFar =
    input.feature === "write" ||
    input.feature === "feedback" ||
    input.feature === "brainstorm" ||
    (input.feature === "bible" &&
      (input.bibleTarget === "draft" || input.bibleTarget === "scenes"));

  const includeStorySoFar =
    Boolean(input.previousChapterSummaries?.trim()) &&
    (effectiveNodes ? effectiveNodes.has("story_so_far") : legacyIncludeStorySoFar);

  if (includeStorySoFar && input.previousChapterSummaries) {
    const cappedStorySoFar = input.previousChapterSummaries.trim().slice(-MAX_STORY_SO_FAR_CHARS);
    chapterNodes.push(xmlNode("story_so_far", cappedStorySoFar));
  }

  const legacyIncludeScenes =
    input.feature === "write" ||
    input.feature === "feedback" ||
    input.feature === "brainstorm" ||
    (input.feature === "bible" &&
      (input.bibleTarget === "draft" ||
        input.bibleTarget === "scenes" ||
        input.bibleTarget === "chapter_summary"));

  const includeScenes =
    Boolean(input.chapterScenes?.trim()) &&
    (effectiveNodes ? effectiveNodes.has("scenes") : legacyIncludeScenes);

  if (includeScenes && input.chapterScenes) {
    chapterNodes.push(xmlNode("scenes", input.chapterScenes.trim()));
  }

  if (input.feature === "write" && input.keyDetails?.trim()) {
    chapterNodes.push(xmlNode("key_details", input.keyDetails.trim()));
  }

  const legacyIncludeContinuity =
    (input.feature === "bible" && input.bibleTarget === "scenes") ||
    (input.feature === "write" && !input.chapterProse?.trim());

  const continuityDataGuard =
    Boolean(input.previousChapterProseTail?.trim()) &&
    (input.feature !== "write" || !input.chapterProse?.trim());

  const includeContinuity =
    continuityDataGuard &&
    (effectiveNodes ? effectiveNodes.has("previous_chapter_continuity") : legacyIncludeContinuity);

  if (includeContinuity && input.previousChapterProseTail) {
    const tail = input.previousChapterProseTail.trim().slice(-MAX_PREVIOUS_CHAPTER_TAIL_CHARS);
    chapterNodes.push(xmlNode("previous_chapter_continuity", tail));
  }

  const legacyIncludeProseWindow =
    input.feature === "write" ||
    input.feature === "rewrite" ||
    input.feature === "feedback" ||
    input.feature === "expand" ||
    (input.feature === "bible" && input.bibleTarget === "chapter_summary");

  const includeProseWindow =
    Boolean(input.chapterProse?.trim()) &&
    (effectiveNodes ? effectiveNodes.has("preceding_prose") : legacyIncludeProseWindow);

  if (includeProseWindow && input.chapterProse) {
    const rawProse = input.chapterProse.trim();
    let proseWindow = rawProse;
    if (rawProse.length > MAX_CHAPTER_CONTEXT_CHARS) {
      const headChars = Math.floor(MAX_CHAPTER_CONTEXT_CHARS * 0.25);
      const tailChars = MAX_CHAPTER_CONTEXT_CHARS - headChars;
      proseWindow = `${rawProse.slice(0, headChars)}\n...[middle of chapter omitted for context budget]...\n${rawProse.slice(-tailChars)}`;
    }
    chapterNodes.push(xmlNode("preceding_prose", proseWindow));
  }

  const blocks: string[] = [storyBibleXml];

  if (chapterNodes.length > 0) {
    blocks.push(`<chapter_context>\n${chapterNodes.join("\n")}\n</chapter_context>`);
  }

  if (
    (input.feature === "rewrite" || input.feature === "feedback" || input.feature === "expand") &&
    input.selectedText?.trim()
  ) {
    blocks.push(xmlNode("selected_text", input.selectedText.trim(), ""));
  }

  const directive = buildFeatureDirective(input);
  const hasEscapedEntities = /&(?:amp|lt|gt);/.test(`${blocks.join("\n")}\n${directive}`);
  const finalDirective = hasEscapedEntities ? `${directive}\n${XML_ESCAPE_NOTICE}` : directive;
  blocks.push(`<feature_instruction>\n${finalDirective}\n</feature_instruction>`);

  return blocks.join("\n\n");
}

/**
 * Safely parse or coerce an untrusted story state payload into a valid NovelcrafterStoryState.
 * Applies field-level clamping and collection normalization via coerceStoryStateToLimits
 * before Zod validation so a single oversized field never resets a story (NC-01).
 */
export function sanitizeStoryState(
  raw: unknown,
  defaultChapterTitle = "Chapter 1"
): NovelcrafterStoryState {
  const coerced = coerceStoryStateToLimits(raw, defaultChapterTitle);
  if (coerced) {
    const parsed = NovelcrafterStoryStateSchema.safeParse(coerced);
    if (parsed.success) {
      const state = parsed.data;
      const activeExists = state.chapters.some((c) => c.id === state.activeChapterId);
      return {
        ...state,
        activeChapterId: activeExists ? state.activeChapterId : state.chapters[0].id,
        historyCards: state.historyCards.slice(0, MAX_HISTORY_CARDS),
      };
    }
  }
  return createDefaultStoryState(defaultChapterTitle);
}
