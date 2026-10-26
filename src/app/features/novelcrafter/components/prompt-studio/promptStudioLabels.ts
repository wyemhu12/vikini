// /app/features/novelcrafter/components/prompt-studio/promptStudioLabels.ts
// Translation key mapping for all 37 Prompt Studio actions, 6 groups, 11 context nodes, and built-in presets

import type { NovelcrafterContextNode } from "@/lib/features/novelcrafter/contextNodes";
import type { NovelcrafterPromptActionKey } from "@/lib/features/novelcrafter/promptActions";
import type { NovelcrafterBuiltInPresetId } from "@/lib/features/novelcrafter/promptStudioPresets";
import type { NovelcrafterFeatureSlot } from "@/lib/features/novelcrafter/types";
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
