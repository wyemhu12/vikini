// /lib/features/novelcrafter/featureDirectives.ts
// Feature-specific prompt directives for Novelcrafter Studio (6 slots: bible, write, rewrite, feedback, expand, brainstorm)

import { ValidationError } from "@/lib/utils/errors";
import {
  escapeXmlPromptText,
  serializeStoryBibleWithStructuredCards,
} from "./storyBibleSerializer";
import {
  NOVELCRAFTER_DEVELOPMENTAL_CRITERIA,
  type BuildUserPromptInput,
  type NovelcrafterBibleTarget,
  type NovelcrafterBrainstormCategory,
  type NovelcrafterDevelopmentalCriterion,
  type NovelcrafterFeedbackMode,
  type NovelcrafterRewriteMode,
  type NovelcrafterToneShift,
} from "./types";

const TONE_SHIFT_DESCRIPTIONS: Record<NovelcrafterToneShift, string> = {
  ominous: "Ominous — dark, foreboding, tense, with a creeping sense of dread and shadow",
  whimsical: "Fantastical / Whimsical — enchanting, wonder-filled, imaginative, and magical",
  fast_paced: "Fast-Paced — urgent, kinetic, punchy sentences with high momentum",
  intimate: "Sensual / Intimate — close, tactile, emotionally vulnerable, and resonant",
  melancholic: "Conflicted / Melancholic — bittersweet, introspective, heavy with emotional weight",
  suspenseful: "Authoritative / Suspenseful — commanding, high-stakes, taut with anticipation",
  humorous: "Upbeat / Humorous — witty, lively, warm, and buoyant",
  epic: "Romantic / Epic — sweeping, passionate, grand in emotion and scale",
};

const REWRITE_MODE_INSTRUCTIONS: Record<NovelcrafterRewriteMode, string> = {
  rephrase: "Rephrase the <selected_text> to improve flow, rhythm, and word choice.",
  shorter:
    "Condense and tighten the <selected_text> to be more concise while preserving key meaning.",
  more_descriptive:
    "Rewrite the <selected_text> with richer sensory details, atmosphere, and evocative imagery.",
  show_dont_tell:
    "Rewrite the <selected_text> using 'Show, Don't Tell'—replace abstract exposition with concrete actions, body language, sensory cues, and subtext.",
  more_inner_conflict:
    "Rewrite the <selected_text> to heighten the character's internal conflict, emotional stakes, and psychological tension.",
  more_intense:
    "Rewrite the <selected_text> to make the action, emotion, and dramatic stakes more intense, visceral, and gripping.",
  custom: "Rewrite and polish the <selected_text>.",
};

const BRAINSTORM_CATEGORY_LABELS: Record<NovelcrafterBrainstormCategory, string> = {
  plot_twists: "5 unexpected yet earned Plot Twists & narrative reversals",
  character_names: "10 evocative Character Names & aliases with brief etymology/vibe notes",
  world_objects: "5 unique Worldbuilding Elements, artifacts, locations, or cultural customs",
  dialogue: "5 sharp, subtext-rich Dialogue lines or exchanges for the current scene",
  scene_ideas: "5 compelling Scene Ideas & dramatic beats for what could happen next",
  characters: "5 distinct Character Concepts with motivations, flaws, and narrative hooks",
  settings: "5 atmospheric Places & Settings with sensory details and story potential",
  magic_systems: "5 cohesive Magic / Technology Rules, limitations, and dramatic costs",
  conflicts: "5 escalating Interpersonal or External Conflicts to raise the stakes",
  titles: "10 memorable Chapter or Book Titles that capture the core theme",
};

const CRITERION_DESCRIPTIONS: Record<NovelcrafterDevelopmentalCriterion, string> = {
  consistency:
    "CONSISTENCY (alignment with Story Bible characters, setting, and established facts)",
  believability:
    "BELIEVABILITY (character motivations, emotional authenticity, and plausible reactions)",
  pacing: "PACING (scene momentum, tension curve, and balance between action and reflection)",
  clarity: "CLARITY (spatial orientation, clear cause-and-effect, and unambiguous phrasing)",
  originality: "ORIGINALITY (fresh imagery, avoiding clichés, and distinctive narrative voice)",
};

const FEEDBACK_FORMAT_CONTRACT = [
  "Return 3 to 6 actionable margin feedback items using ONLY the following XML block format for each item:",
  "<feedback_item>",
  "<category>CATEGORY_NAME</category>",
  "<quote>Exact verbatim sentence or passage copied directly from the chapter prose</quote>",
  "<comment>Concise, specific editorial explanation of the issue and why it matters</comment>",
  "<suggestion>Concrete rewritten replacement for the quoted passage that fixes the issue</suggestion>",
  "</feedback_item>",
  "IMPORTANT: <quote> MUST match an exact substring from the provided prose so the editor can highlight and replace it with 1 click.",
].join("\n");

function buildBibleDirective(input: BuildUserPromptInput, custom: string): string {
  const target = input.bibleTarget;
  if (!target) {
    throw new ValidationError("bibleTarget is required when feature is 'bible'");
  }
  const mode = input.actionMode || "generate";

  if (target === "draft") {
    const extra = escapeXmlPromptText(input.chapterExtraInstructions?.trim() || "");
    return [
      "Write a rich, immersive chapter draft based on the provided <story_bible> (Style, Genre, Characters, Worldbuilding, POV & Tense) and <chapter_context> (Scenes / Chapter Beats).",
      extra ? `Chapter Extra Instructions: ${extra}` : "",
      custom ? `Additional Author Direction: ${custom}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const serializedBible = serializeStoryBibleWithStructuredCards(input.storyBible);
  const existingContentByTarget: Record<Exclude<NovelcrafterBibleTarget, "draft">, string> = {
    synopsis: input.storyBible.synopsis.trim(),
    characters: serializedBible.charactersText.trim(),
    worldbuilding: serializedBible.worldbuildingText.trim(),
    outline: serializedBible.outlineText.trim(),
    scenes: input.chapterScenes?.trim() || "",
    chapter_summary: input.chapterSummary?.trim() || "",
  };
  const currentSectionValue = existingContentByTarget[target];

  if (mode === "rewrite" && !currentSectionValue && !custom) {
    throw new ValidationError(
      `Cannot rewrite empty Story Bible section '${target}' without instructions or existing text`
    );
  }

  if (
    target === "chapter_summary" &&
    mode === "generate" &&
    !input.chapterProse?.trim() &&
    !input.chapterScenes?.trim() &&
    !custom
  ) {
    throw new ValidationError(
      "Cannot generate chapter summary: chapterProse or chapterScenes is required when both chapter prose and scene beats are empty"
    );
  }

  if (mode === "rewrite") {
    return [
      `Rewrite and improve the ${target.toUpperCase()} section based on the <story_bible> context.`,
      currentSectionValue
        ? `<current_${target}>\n${escapeXmlPromptText(currentSectionValue)}\n</current_${target}>`
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
      "Generate a structured, chapter-by-chapter Story Outline based on the Genre, Synopsis, Characters, Worldbuilding, and Narrative POV/Tense.",
    scenes:
      "Generate detailed Scene Beats (Chapter Beats) for the current chapter based on the Story Outline, Genre, Style, Characters, Worldbuilding, and previous chapter continuity.",
    chapter_summary:
      "Write a concise 3-to-5 bullet Rolling Chapter Summary (150-300 words) capturing the key plot events, character state changes, revelations, and unresolved hooks from <preceding_prose> and <scenes> so subsequent chapters can use it as rolling story memory.",
  };

  return [targetGuides[target], custom ? `Additional Author Direction: ${custom}` : ""]
    .filter(Boolean)
    .join("\n");
}

function buildFeedbackDirective(input: BuildUserPromptInput, custom: string): string {
  const prose = input.chapterProse?.trim() || "";
  const selected = input.selectedText?.trim() || "";
  if (!prose && !selected) {
    throw new ValidationError(
      "chapterProse or selectedText is required when feature is 'feedback'"
    );
  }

  const mode: NovelcrafterFeedbackMode = input.feedbackMode || "developmental";

  if (mode === "beta_read") {
    return [
      "Act as Sudowrite's 3 AI Beta Readers reviewing the prose:",
      "- MAYA (Focus: Emotional resonance, character empathy, chemistry, and heartfelt moments)",
      "- ANTON (Focus: Story structure, pacing, scene momentum, and character motivation)",
      "- JOAN (Focus: Plausibility, worldbuilding logic, continuity, and factual details)",
      "Use MAYA, ANTON, or JOAN as the <category> tag for each feedback item.",
      custom ? `Author Focus Note: ${custom}` : "",
      FEEDBACK_FORMAT_CONTRACT,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (mode === "developmental") {
    const selectedCriteria =
      input.feedbackCriteria && input.feedbackCriteria.length > 0
        ? input.feedbackCriteria
        : [...NOVELCRAFTER_DEVELOPMENTAL_CRITERIA];
    const criteriaList = selectedCriteria.map((c) => CRITERION_DESCRIPTIONS[c]).join("; ");
    return [
      `Provide Developmental Editing feedback checking the prose against the <story_bible> and focusing on: ${criteriaList}.`,
      custom ? `Additional Editorial Focus: ${custom}` : "",
      FEEDBACK_FORMAT_CONTRACT,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const modeDescriptions: Record<
    Exclude<NovelcrafterFeedbackMode, "developmental" | "beta_read">,
    string
  > = {
    line_editing:
      "Provide Line Editing feedback (category: LINE) to sharpen sentence rhythm, eliminate wordiness, and strengthen imagery.",
    dialogue:
      "Provide Dialogue Editing feedback (category: DIALOGUE) to make character voices distinct, natural, and rich with subtext.",
    copy_editing:
      "Provide Copy Editing feedback (category: COPY) to fix grammar, punctuation, tense consistency, and awkward mechanics.",
    custom: custom
      ? `Provide targeted editorial feedback according to this instruction: ${custom}`
      : "Provide constructive editorial feedback on the prose.",
  };

  return [
    modeDescriptions[mode],
    mode !== "custom" && custom ? `Additional Editorial Focus: ${custom}` : "",
    FEEDBACK_FORMAT_CONTRACT,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFeatureDirective(input: BuildUserPromptInput): string {
  const custom = escapeXmlPromptText(input.customInstruction?.trim() || "");
  const extraRaw = input.chapterExtraInstructions?.trim() || "";
  const chapterExtra = extraRaw
    ? `Chapter Extra Instructions: ${escapeXmlPromptText(extraRaw)}`
    : "";

  if (input.feature === "bible") {
    return buildBibleDirective(input, custom);
  }

  if (input.feature === "write") {
    const mode = input.writeMode || "auto";
    const lengthTarget = input.writeLengthWords
      ? `Target output length: approximately ${input.writeLengthWords} words.`
      : "";
    if (mode === "first_draft_rough") {
      return [
        "Generate a complete, engaging Rough Draft of this chapter from start to finish based on the <story_bible> (Synopsis, Outline, Characters, Worldbuilding, Style, POV & Tense) and <chapter_context>.",
        lengthTarget || "Target output length: approximately 800 to 1,200 words.",
        chapterExtra,
        custom ? `Additional Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (mode === "openings_3") {
      return [
        "Generate 3 distinct, compelling Chapter Openings (~200–300 words each) for this chapter:",
        "1. Action/Conflict Hook",
        "2. Sensory/Atmosphere Immersion",
        "3. Character/Dialogue Hook",
        "Format your output using EXACT delimiters so each option can be parsed into its own card:",
        "=== OPENING 1: Action/Conflict Hook ===",
        "[prose]",
        "=== OPENING 2: Sensory/Atmosphere Immersion ===",
        "[prose]",
        "=== OPENING 3: Character/Dialogue Hook ===",
        "[prose]",
        chapterExtra,
        custom ? `Additional Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (mode === "tone_shift") {
      const tone = input.toneShift || "ominous";
      return [
        `Continue writing the next passage of the chapter while shifting the narrative tone to: ${TONE_SHIFT_DESCRIPTIONS[tone]}.`,
        lengthTarget,
        chapterExtra,
        custom ? `Additional Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (mode === "guided" && custom) {
      return [
        `Continue writing the next passage of the chapter seamlessly following the preceding prose and scenes. Guided Direction: ${custom}`,
        lengthTarget,
        chapterExtra,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      "Continue writing the next passage of the chapter naturally and seamlessly from where the preceding prose ends, following the Chapter Scenes and Style.",
      lengthTarget,
      chapterExtra,
      custom ? `Additional Direction: ${custom}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (input.feature === "rewrite") {
    const selected = input.selectedText?.trim() || "";
    if (!selected) {
      throw new ValidationError("selectedText is required for Rewrite feature");
    }
    const mode = input.rewriteMode || "rephrase";
    const baseInstruction =
      mode === "custom" && custom
        ? `Rewrite the <selected_text> according to this instruction: ${custom}`
        : REWRITE_MODE_INSTRUCTIONS[mode];
    return [
      baseInstruction,
      chapterExtra,
      mode !== "custom" && custom ? `Additional note: ${custom}` : "",
      "Return ONLY the rewritten passage ready to replace <selected_text>.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (input.feature === "feedback") {
    return buildFeedbackDirective(input, custom);
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
        chapterExtra,
        custom ? `Additional focus: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      "Expand the <selected_text> to slow down the pacing, adding scene depth, dialogue beats, micro-actions, and atmosphere without rushing the plot.",
      chapterExtra,
      custom ? `Additional focus: ${custom}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // feature === "brainstorm"
  const category = input.brainstormCategory || "plot_twists";
  return [
    `Brainstorm ${BRAINSTORM_CATEGORY_LABELS[category]} that fit the <story_bible> and current chapter.`,
    custom ? `Specific Brainstorm Topic / Question: ${custom}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
