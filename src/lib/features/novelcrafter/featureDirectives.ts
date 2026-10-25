// /lib/features/novelcrafter/featureDirectives.ts
// Feature-specific prompt directives for Novelcrafter Studio (6 slots: bible, write, rewrite, feedback, expand, brainstorm)

import { ValidationError } from "@/lib/utils/errors";
import {
  DEFAULT_PROMPT_DIRECTIVES,
  renderDirectiveTemplate,
  sanitizeDirectiveOverride,
  type DirectiveTemplateVars,
} from "./promptDirectiveDefaults";
import type { NovelcrafterPromptActionKey } from "./promptActions";
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

export const FEEDBACK_FORMAT_CONTRACT = [
  "Return 3 to 6 actionable margin feedback items using ONLY the following XML block format for each item:",
  "<feedback_item>",
  "<category>CATEGORY_NAME</category>",
  "<quote>Exact verbatim sentence or passage copied directly from the chapter prose</quote>",
  "<comment>Concise, specific editorial explanation of the issue and why it matters</comment>",
  "<suggestion>Concrete rewritten replacement for the quoted passage that fixes the issue</suggestion>",
  "</feedback_item>",
  "IMPORTANT: <quote> MUST match an exact substring from the provided prose so the editor can highlight and replace it with 1 click.",
].join("\n");

function resolveBaseDirective(
  key: NovelcrafterPromptActionKey,
  input: BuildUserPromptInput,
  vars?: DirectiveTemplateVars
): string {
  const raw = input.promptDirectiveOverride?.trim();
  return raw
    ? renderDirectiveTemplate(sanitizeDirectiveOverride(raw), vars)
    : renderDirectiveTemplate(DEFAULT_PROMPT_DIRECTIVES[key], vars);
}

function buildBibleDirective(input: BuildUserPromptInput, custom: string): string {
  const target = input.bibleTarget;
  if (!target) {
    throw new ValidationError("bibleTarget is required when feature is 'bible'");
  }
  const mode = input.actionMode || "generate";

  if (target === "draft") {
    const extra = escapeXmlPromptText(input.chapterExtraInstructions?.trim() || "");
    return [
      resolveBaseDirective("bible:draft", input),
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

  return [
    resolveBaseDirective(`bible:${target}`, input),
    custom ? `Additional Author Direction: ${custom}` : "",
  ]
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
      resolveBaseDirective("feedback:beta_read", input),
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
      resolveBaseDirective("feedback:developmental", input, { criteria: criteriaList }),
      custom ? `Additional Editorial Focus: ${custom}` : "",
      FEEDBACK_FORMAT_CONTRACT,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const hasOverride = Boolean(input.promptDirectiveOverride?.trim());
  if (mode === "custom" && custom && !hasOverride) {
    return [
      `Provide targeted editorial feedback according to this instruction: ${custom}`,
      FEEDBACK_FORMAT_CONTRACT,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    resolveBaseDirective(`feedback:${mode}`, input),
    (mode !== "custom" || hasOverride) && custom ? `Additional Editorial Focus: ${custom}` : "",
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
        resolveBaseDirective("write:first_draft_rough", input),
        lengthTarget || "Target output length: approximately 800 to 1,200 words.",
        chapterExtra,
        custom ? `Additional Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (mode === "openings_3") {
      return [
        resolveBaseDirective("write:openings_3", input),
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
        resolveBaseDirective("write:tone_shift", input, {
          tone: TONE_SHIFT_DESCRIPTIONS[tone],
        }),
        lengthTarget,
        chapterExtra,
        custom ? `Additional Direction: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    if (mode === "guided") {
      const hasOverride = Boolean(input.promptDirectiveOverride?.trim());
      if (custom && !hasOverride) {
        return [
          `${resolveBaseDirective("write:guided", input)} Guided Direction: ${custom}`,
          lengthTarget,
          chapterExtra,
        ]
          .filter(Boolean)
          .join("\n");
      }
      if (hasOverride) {
        return [
          resolveBaseDirective("write:guided", input),
          lengthTarget,
          chapterExtra,
          custom ? `Additional Direction: ${custom}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
    return [
      resolveBaseDirective("write:auto", input),
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
    const hasOverride = Boolean(input.promptDirectiveOverride?.trim());
    const baseInstruction =
      mode === "custom" && custom && !hasOverride
        ? `Rewrite the <selected_text> according to this instruction: ${custom}`
        : resolveBaseDirective(`rewrite:${mode}`, input);
    return [
      baseInstruction,
      chapterExtra,
      (mode !== "custom" || hasOverride) && custom ? `Additional note: ${custom}` : "",
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
        resolveBaseDirective("expand:describe", input, { senses }),
        chapterExtra,
        custom ? `Additional focus: ${custom}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    return [
      resolveBaseDirective("expand:expand", input),
      chapterExtra,
      custom ? `Additional focus: ${custom}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // feature === "brainstorm"
  const category = input.brainstormCategory || "plot_twists";
  return [
    resolveBaseDirective(`brainstorm:${category}`, input, {
      category: BRAINSTORM_CATEGORY_LABELS[category],
    }),
    custom ? `Specific Brainstorm Topic / Question: ${custom}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
