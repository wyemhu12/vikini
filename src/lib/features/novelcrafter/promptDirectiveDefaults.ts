// /lib/features/novelcrafter/promptDirectiveDefaults.ts
// Default directive templates, template renderer, and XML breakout sanitizer for Prompt Studio

import { MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS } from "./contextNodes";
import type { NovelcrafterPromptActionKey } from "./promptActions";
import { escapeXmlPromptText } from "./storyBibleSerializer";

export const PROMPT_DIRECTIVE_PLACEHOLDERS = [
  "{{tone}}",
  "{{criteria}}",
  "{{senses}}",
  "{{category}}",
] as const;

const BRAINSTORM_TEMPLATE =
  "Brainstorm {{category}} that fit the <story_bible> and current chapter.";

export const DEFAULT_PROMPT_DIRECTIVES: Record<NovelcrafterPromptActionKey, string> = {
  "bible:synopsis":
    "Generate a compelling, well-structured Synopsis covering the core setup, inciting incident, rising conflict, climax, and resolution based on the Braindump and Genre.",
  "bible:characters":
    "Generate detailed Character Profiles (names, roles, physical/personality traits, motivations, internal/external conflicts, and relationships) derived from the Synopsis.",
  "bible:worldbuilding":
    "Generate rich Worldbuilding elements (setting, atmosphere, rules/magic/technology systems, factions, and key locations) derived from the Synopsis.",
  "bible:outline":
    "Generate a structured, chapter-by-chapter Story Outline based on the Genre, Synopsis, Characters, Worldbuilding, and Narrative POV/Tense.",
  "bible:scenes":
    "Generate detailed Scene Beats (Chapter Beats) for the current chapter based on the Story Outline, Genre, Style, Characters, Worldbuilding, and previous chapter continuity.",
  "bible:chapter_summary":
    "Write a concise 3-to-5 bullet Rolling Chapter Summary (150-300 words) capturing the key plot events, character state changes, revelations, and unresolved hooks from <preceding_prose> and <scenes> so subsequent chapters can use it as rolling story memory.",
  "bible:draft":
    "Write a rich, immersive chapter draft based on the provided <story_bible> (Synopsis, Outline, Style, Genre, Characters, Worldbuilding, POV & Tense) and <chapter_context> (Scenes / Chapter Beats).",
  "write:auto":
    "Continue writing the next passage of the chapter naturally and seamlessly from where the preceding prose ends, following the Chapter Scenes and Style.",
  "write:guided":
    "Continue writing the next passage of the chapter seamlessly following the preceding prose and scenes.",
  "write:tone_shift":
    "Continue writing the next passage of the chapter while shifting the narrative tone to: {{tone}}.",
  "write:first_draft_rough":
    "Generate a complete, engaging Rough Draft of this chapter from start to finish based on the <story_bible> (Synopsis, Outline, Characters, Worldbuilding, Style, POV & Tense) and <chapter_context>.",
  "write:openings_3": [
    "Generate 3 distinct, compelling Chapter Openings (~200–300 words each) for this chapter:",
    "1. Action/Conflict Hook",
    "2. Sensory/Atmosphere Immersion",
    "3. Character/Dialogue Hook",
  ].join("\n"),
  "rewrite:rephrase": "Rephrase the <selected_text> to improve flow, rhythm, and word choice.",
  "rewrite:shorter":
    "Condense and tighten the <selected_text> to be more concise while preserving key meaning.",
  "rewrite:more_descriptive":
    "Rewrite the <selected_text> with richer sensory details, atmosphere, and evocative imagery.",
  "rewrite:show_dont_tell":
    "Rewrite the <selected_text> using 'Show, Don't Tell'—replace abstract exposition with concrete actions, body language, sensory cues, and subtext.",
  "rewrite:more_inner_conflict":
    "Rewrite the <selected_text> to heighten the character's internal conflict, emotional stakes, and psychological tension.",
  "rewrite:more_intense":
    "Rewrite the <selected_text> to make the action, emotion, and dramatic stakes more intense, visceral, and gripping.",
  "rewrite:custom": "Rewrite and polish the <selected_text>.",
  "feedback:developmental":
    "Provide Developmental Editing feedback checking the prose against the <story_bible> and focusing on: {{criteria}}.",
  "feedback:line_editing":
    "Provide Line Editing feedback (category: LINE) to sharpen sentence rhythm, eliminate wordiness, and strengthen imagery.",
  "feedback:dialogue":
    "Provide Dialogue Editing feedback (category: DIALOGUE) to make character voices distinct, natural, and rich with subtext.",
  "feedback:copy_editing":
    "Provide Copy Editing feedback (category: COPY) to fix grammar, punctuation, tense consistency, and awkward mechanics.",
  "feedback:beta_read": [
    "Act as Sudowrite's 3 AI Beta Readers reviewing the prose:",
    "- MAYA (Focus: Emotional resonance, character empathy, chemistry, and heartfelt moments)",
    "- ANTON (Focus: Story structure, pacing, scene momentum, and character motivation)",
    "- JOAN (Focus: Plausibility, worldbuilding logic, continuity, and factual details)",
  ].join("\n"),
  "feedback:custom": "Provide constructive editorial feedback on the prose.",
  "expand:expand":
    "Expand the <selected_text> to slow down the pacing, adding scene depth, dialogue beats, micro-actions, and atmosphere without rushing the plot.",
  "expand:describe":
    "Provide vivid sensory descriptions and metaphors for <selected_text>, focusing on: {{senses}}.",
  "brainstorm:plot_twists": BRAINSTORM_TEMPLATE,
  "brainstorm:character_names": BRAINSTORM_TEMPLATE,
  "brainstorm:world_objects": BRAINSTORM_TEMPLATE,
  "brainstorm:dialogue": BRAINSTORM_TEMPLATE,
  "brainstorm:scene_ideas": BRAINSTORM_TEMPLATE,
  "brainstorm:characters": BRAINSTORM_TEMPLATE,
  "brainstorm:settings": BRAINSTORM_TEMPLATE,
  "brainstorm:magic_systems": BRAINSTORM_TEMPLATE,
  "brainstorm:conflicts": BRAINSTORM_TEMPLATE,
  "brainstorm:titles": BRAINSTORM_TEMPLATE,
};

export interface DirectiveTemplateVars {
  tone?: string;
  criteria?: string;
  senses?: string;
  category?: string;
}

const KNOWN_PLACEHOLDER_REGEX = /\{\{(tone|criteria|senses|category)\}\}/g;

export function renderDirectiveTemplate(
  template: string,
  vars: DirectiveTemplateVars = {}
): string {
  return template.replace(
    KNOWN_PLACEHOLDER_REGEX,
    (fullMatch, key: keyof DirectiveTemplateVars) => {
      const val = vars[key];
      return typeof val === "string" ? val : fullMatch;
    }
  );
}

const ALLOWLISTED_OPEN_TAGS = [
  "story_bible",
  "chapter_context",
  "selected_text",
  "preceding_prose",
  "scenes",
  "story_so_far",
  "synopsis",
  "outline",
  "characters",
  "worldbuilding",
  "style",
  "genre",
  "key_details",
  "previous_chapter_continuity",
  "chapter_title",
  "category",
] as const;

const RESTORE_OPEN_TAG_REGEX = new RegExp(`&lt;(${ALLOWLISTED_OPEN_TAGS.join("|")})&gt;`, "g");

/**
 * Sanitize a user-supplied directive override:
 * 1. Truncate to MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS (4000) before escaping.
 * 2. XML-escape all &, <, > so closing tags like </feature_instruction> can never break out.
 * 3. Restore ONLY allowlisted opening reference tags (e.g. <selected_text>, <story_bible>).
 */
export function sanitizeDirectiveOverride(raw: string): string {
  const truncated = raw.slice(0, MAX_PROMPT_DIRECTIVE_OVERRIDE_CHARS);
  const escaped = escapeXmlPromptText(truncated);
  return escaped.replace(RESTORE_OPEN_TAG_REGEX, "<$1>");
}
