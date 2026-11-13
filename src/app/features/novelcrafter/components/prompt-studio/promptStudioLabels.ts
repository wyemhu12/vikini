// /app/features/novelcrafter/components/prompt-studio/promptStudioLabels.ts
// Translation key mapping for all 37 Prompt Studio actions, 6 groups, 11 context nodes, and built-in presets

import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import type { NovelcrafterBuiltInPresetId } from "@/lib/features/novelcrafter/promptStudioPresets";
import type { NovelcrafterFeatureSlot } from "@/lib/features/novelcrafter/types";
import type { XmlSemanticGroup } from "@/lib/features/novelcrafter/xmlPreviewHighlighter";
import type { TranslationKey } from "@/lib/utils/translations";

export const PROMPT_GROUP_LABELS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterPromptStudioGroupBible",
  write: "novelcrafterPromptStudioGroupWrite",
  rewrite: "novelcrafterPromptStudioGroupRewrite",
  feedback: "novelcrafterPromptStudioGroupFeedback",
  expand: "novelcrafterPromptStudioGroupExpand",
  brainstorm: "novelcrafterPromptStudioGroupBrainstorm",
};

export const PROMPT_ACTION_LABELS: Record<NovelcrafterPromptActionKey, TranslationKey> = {
  "bible:synopsis": "novelcrafterPromptActionBibleSynopsis",
  "bible:characters": "novelcrafterPromptActionBibleCharacters",
  "bible:worldbuilding": "novelcrafterPromptActionBibleWorldbuilding",
  "bible:outline": "novelcrafterPromptActionBibleOutline",
  "bible:scenes": "novelcrafterPromptActionBibleScenes",
  "bible:draft": "novelcrafterPromptActionBibleDraft",
  "bible:chapter_summary": "novelcrafterPromptActionBibleChapterSummary",
  "write:auto": "novelcrafterWriteAuto",
  "write:guided": "novelcrafterWriteGuided",
  "write:tone_shift": "novelcrafterWriteToneShift",
  "write:first_draft_rough": "novelcrafterPromptActionWriteFirstDraftRough",
  "write:openings_3": "novelcrafterPromptActionWriteOpenings3",
  "rewrite:rephrase": "novelcrafterRewriteRephrase",
  "rewrite:shorter": "novelcrafterRewriteShorter",
  "rewrite:more_descriptive": "novelcrafterRewriteMoreDescriptive",
  "rewrite:show_dont_tell": "novelcrafterRewriteShowDontTell",
  "rewrite:more_inner_conflict": "novelcrafterRewriteInnerConflict",
  "rewrite:more_intense": "novelcrafterRewriteMoreIntense",
  "rewrite:custom": "novelcrafterRewriteCustom",
  "feedback:developmental": "novelcrafterFeedbackDevelopmental",
  "feedback:line_editing": "novelcrafterFeedbackLine",
  "feedback:dialogue": "novelcrafterFeedbackDialogue",
  "feedback:copy_editing": "novelcrafterFeedbackCopy",
  "feedback:beta_read": "novelcrafterFeedbackBetaRead",
  "feedback:custom": "novelcrafterFeedbackCustom",
  "expand:expand": "novelcrafterExpandPassage",
  "expand:describe": "novelcrafterPromptActionExpandDescribe",
  "brainstorm:plot_twists": "novelcrafterBrainstormTwists",
  "brainstorm:character_names": "novelcrafterBrainstormNames",
  "brainstorm:world_objects": "novelcrafterBrainstormWorld",
  "brainstorm:dialogue": "novelcrafterBrainstormDialogue",
  "brainstorm:scene_ideas": "novelcrafterBrainstormScenes",
  "brainstorm:characters": "novelcrafterBrainstormCharacters",
  "brainstorm:settings": "novelcrafterBrainstormSettings",
  "brainstorm:magic_systems": "novelcrafterBrainstormMagic",
  "brainstorm:conflicts": "novelcrafterBrainstormConflicts",
  "brainstorm:titles": "novelcrafterBrainstormTitles",
};

export const CONTEXT_NODE_LABELS: Record<NovelcrafterContextNode, TranslationKey> = {
  synopsis: "novelcrafterContextNodeSynopsis",
  outline: "novelcrafterContextNodeOutline",
  characters: "novelcrafterContextNodeCharacters",
  worldbuilding: "novelcrafterContextNodeWorldbuilding",
  style: "novelcrafterContextNodeStyle",
  genre: "novelcrafterContextNodeGenre",
  pov_tense: "novelcrafterContextNodePovTense",
  story_so_far: "novelcrafterContextNodeStorySoFar",
  scenes: "novelcrafterContextNodeScenes",
  previous_chapter_continuity: "novelcrafterContextNodePreviousChapterContinuity",
  preceding_prose: "novelcrafterContextNodePrecedingProse",
};

export const BUILT_IN_PRESET_LABELS: Record<NovelcrafterBuiltInPresetId, TranslationKey> = {
  default: "novelcrafterPromptStudioPresetDefault",
  lean_context: "novelcrafterPromptStudioPresetLeanContext",
  deep_continuity: "novelcrafterPromptStudioPresetDeepContinuity",
};

export const PROMPT_SIDEBAR_GROUP_LABELS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterStudioGroupBible",
  write: "novelcrafterStudioGroupWrite",
  rewrite: "novelcrafterStudioGroupRewrite",
  feedback: "novelcrafterStudioGroupFeedback",
  expand: "novelcrafterStudioGroupExpand",
  brainstorm: "novelcrafterStudioGroupBrainstorm",
};

export const PROMPT_SIDEBAR_ACTION_LABELS: Record<NovelcrafterPromptActionKey, TranslationKey> = {
  "bible:synopsis": "novelcrafterStudioBibleSynopsis",
  "bible:characters": "novelcrafterStudioBibleCharacters",
  "bible:worldbuilding": "novelcrafterStudioBibleWorldbuilding",
  "bible:outline": "novelcrafterStudioBibleOutline",
  "bible:scenes": "novelcrafterStudioBibleScenes",
  "bible:draft": "novelcrafterStudioBibleDraft",
  "bible:chapter_summary": "novelcrafterStudioBibleChapterSummary",
  "write:auto": "novelcrafterWriteAuto",
  "write:guided": "novelcrafterWriteGuided",
  "write:tone_shift": "novelcrafterWriteToneShift",
  "write:first_draft_rough": "novelcrafterStudioWriteRoughDraft",
  "write:openings_3": "novelcrafterStudioWriteOpenings3",
  "rewrite:rephrase": "novelcrafterRewriteRephrase",
  "rewrite:shorter": "novelcrafterRewriteShorter",
  "rewrite:more_descriptive": "novelcrafterRewriteMoreDescriptive",
  "rewrite:show_dont_tell": "novelcrafterRewriteShowDontTell",
  "rewrite:more_inner_conflict": "novelcrafterRewriteInnerConflict",
  "rewrite:more_intense": "novelcrafterRewriteMoreIntense",
  "rewrite:custom": "novelcrafterRewriteCustom",
  "feedback:developmental": "novelcrafterFeedbackDevelopmental",
  "feedback:line_editing": "novelcrafterFeedbackLine",
  "feedback:dialogue": "novelcrafterFeedbackDialogue",
  "feedback:copy_editing": "novelcrafterFeedbackCopy",
  "feedback:beta_read": "novelcrafterFeedbackBetaRead",
  "feedback:custom": "novelcrafterFeedbackCustom",
  "expand:expand": "novelcrafterExpandPassage",
  "expand:describe": "novelcrafterStudioExpandDescribe",
  "brainstorm:plot_twists": "novelcrafterBrainstormTwists",
  "brainstorm:character_names": "novelcrafterBrainstormNames",
  "brainstorm:world_objects": "novelcrafterBrainstormWorld",
  "brainstorm:dialogue": "novelcrafterBrainstormDialogue",
  "brainstorm:scene_ideas": "novelcrafterBrainstormScenes",
  "brainstorm:characters": "novelcrafterBrainstormCharacters",
  "brainstorm:settings": "novelcrafterBrainstormSettings",
  "brainstorm:magic_systems": "novelcrafterStudioBrainstormMagic",
  "brainstorm:conflicts": "novelcrafterBrainstormConflicts",
  "brainstorm:titles": "novelcrafterBrainstormTitles",
};

export const CONTEXT_NODE_SHORT_LABELS: Record<NovelcrafterContextNode, TranslationKey> = {
  synopsis: "novelcrafterContextShortSynopsis",
  outline: "novelcrafterContextShortOutline",
  characters: "novelcrafterContextShortCharacters",
  worldbuilding: "novelcrafterContextShortWorldbuilding",
  style: "novelcrafterContextShortStyle",
  genre: "novelcrafterContextShortGenre",
  pov_tense: "novelcrafterContextShortPovTense",
  story_so_far: "novelcrafterContextShortStorySoFar",
  scenes: "novelcrafterContextShortScenes",
  previous_chapter_continuity: "novelcrafterContextShortPreviousChapterContinuity",
  preceding_prose: "novelcrafterContextShortPrecedingProse",
};

export const XML_GROUP_STYLES: Record<
  XmlSemanticGroup,
  { text: string; badge: string; activeHighlight: string; guideHover: string }
> = {
  bible: {
    text: "text-(--xml-bible)",
    badge: "text-(--xml-bible) bg-(--xml-bible-soft) border-(--xml-bible)/30",
    activeHighlight: "bg-(--xml-bible-soft) ring-1 ring-(--xml-bible)/45",
    guideHover: "border-(--xml-bible)/55",
  },
  style: {
    text: "text-(--xml-style)",
    badge: "text-(--xml-style) bg-(--xml-style-soft) border-(--xml-style)/30",
    activeHighlight: "bg-(--xml-style-soft) ring-1 ring-(--xml-style)/45",
    guideHover: "border-(--xml-style)/55",
  },
  chapter: {
    text: "text-(--xml-chapter)",
    badge: "text-(--xml-chapter) bg-(--xml-chapter-soft) border-(--xml-chapter)/30",
    activeHighlight: "bg-(--xml-chapter-soft) ring-1 ring-(--xml-chapter)/45",
    guideHover: "border-(--xml-chapter)/55",
  },
  directive: {
    text: "text-(--xml-directive)",
    badge: "text-(--xml-directive) bg-(--xml-directive-soft) border-(--xml-directive)/30",
    activeHighlight: "bg-(--xml-directive-soft) ring-1 ring-(--xml-directive)/45",
    guideHover: "border-(--xml-directive)/55",
  },
};
