// /lib/features/novelcrafter/outputContracts.ts
// Output contracts appended by code after the (Prompt Studio-overridable) feature directive:
// output language, prose-only output, parser-compatible formats, feedback and brainstorm formats.

import type { NovelcrafterBibleTarget, NovelcrafterDevelopmentalCriterion } from "./types";

export const OUTPUT_LANGUAGE_RULE = [
  "Language: write your entire response in the same language as the author's own text in this request",
  "(manuscript prose, Story Bible, chapter notes, author directions). If they mix languages, follow the manuscript prose.",
  "Keep character names and invented terms exactly as written, and keep every structural token exactly as given above:",
  "XML tags, the === OPENING n === delimiters, category names (e.g. MAYA, ANTON, JOAN, PACING, LINE, COPY),",
  "and the '## ' / '- ' line prefixes. Never translate those tokens.",
].join(" ");

export type ProseOnlyKind = "continue" | "chapter_draft";

export function buildProseOnlyContract(kind: ProseOnlyKind): string {
  return [
    "Output only the story prose itself: no title or chapter heading, no preamble or closing remarks, no notes,",
    "no Markdown headings or bullet/numbered lists. Inline emphasis and a scene-break line (***) are allowed.",
    kind === "continue"
      ? "If the chapter already has prose, continue exactly where it ends and do not repeat any of it; if it is empty, write the chapter's opening passage."
      : "Do not include the chapter title; begin directly with the first line of the chapter.",
  ].join("\n");
}

export const PASSAGE_ONLY_CONTRACT =
  "Return only the finished passage that will replace <selected_text>: no preamble, no notes, no quotation marks around it, no Markdown headings or lists.";

const SECTION_ONLY_RULE =
  "Output only the content of this section, ready to save into the Story Bible: no preamble, no closing remarks, no section title.";

export function buildBibleSectionContract(
  target: Exclude<NovelcrafterBibleTarget, "draft">
): string {
  switch (target) {
    case "characters":
      return [
        "Format: one section per character. Start each section with a level-2 Markdown heading exactly like `## Name (Role)`.",
        "Inside a profile use bold labels such as **Traits:** or **Motivation:**, never any other '#' heading. No introduction or closing text.",
      ].join("\n");
    case "scenes":
      return "Format: output only the beats, one beat per line, each line starting with `- `. No headings, numbering, blank lines or commentary.";
    case "chapter_summary":
      return "Format: 3 to 5 lines, each starting with `- `. No heading or commentary.";
    default:
      return SECTION_ONLY_RULE;
  }
}

export interface FeedbackFormatOptions {
  maxItems: number;
  /** True when the author selected a passage: feedback must stay inside it. */
  selectionOnly: boolean;
}

export function buildFeedbackFormatContract({
  maxItems,
  selectionOnly,
}: FeedbackFormatOptions): string {
  const minItems = selectionOnly ? 1 : 3;
  return [
    `Return ${minItems} to ${maxItems} actionable margin feedback items using ONLY the following XML block format for each item:`,
    "<feedback_item>",
    "<category>CATEGORY_NAME</category>",
    "<quote>Exact verbatim sentence or passage copied directly from the chapter prose</quote>",
    "<comment>Concise, specific editorial explanation of the issue and why it matters</comment>",
    "<suggestion>Concrete rewritten replacement for the quoted passage that fixes the issue</suggestion>",
    "</feedback_item>",
    "IMPORTANT: <quote> MUST match an exact substring from the provided prose so the editor can highlight and replace it with 1 click.",
    "Output only <feedback_item> blocks, nothing before or after them.",
    selectionOnly
      ? "Only comment on <selected_text>; every <quote> must be an exact substring of <selected_text>."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDevelopmentalCategoryRule(
  criteria: readonly NovelcrafterDevelopmentalCriterion[]
): string {
  return `Use exactly one of these as the <category> of each item: ${criteria
    .map((c) => c.toUpperCase())
    .join(", ")}.`;
}

export const BRAINSTORM_FORMAT_CONTRACT =
  "Format: a numbered list. Each item starts with a short bold title, followed by one or two sentences on why it fits this story. " +
  "Do not repeat ideas, names or elements already present in <story_bible>. No introduction or closing remarks.";

export const OPENINGS_ONLY_CONTRACT = "Output nothing outside the three delimited openings.";
