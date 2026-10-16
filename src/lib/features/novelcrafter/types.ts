// /lib/features/novelcrafter/types.ts
// Domain types, constants, and Zod v4 schemas for Novelcrafter Studio

import { z } from "zod";
import { DEFAULT_MODEL } from "@/lib/core/modelRegistry";
import { UUID_REGEX } from "@/lib/utils/constants";

export const STALE_STORY_STATE_MESSAGE = "Stale story state rejected" as const;

export const NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS = [
  "bible",
  "write",
  "rewrite",
  "expand",
  "brainstorm",
] as const;
export type NovelcrafterHistoryCardFeatureSlot =
  (typeof NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS)[number];
export const NOVELCRAFTER_FEATURE_SLOTS = [
  "bible",
  "write",
  "rewrite",
  "feedback",
  "expand",
  "brainstorm",
] as const;
export type NovelcrafterFeatureSlot = (typeof NOVELCRAFTER_FEATURE_SLOTS)[number];
export const NOVELCRAFTER_BIBLE_TARGETS = [
  "synopsis",
  "characters",
  "worldbuilding",
  "outline",
  "scenes",
  "draft",
] as const;
export type NovelcrafterBibleTarget = (typeof NOVELCRAFTER_BIBLE_TARGETS)[number];
export const NOVELCRAFTER_ACTION_MODES = ["generate", "rewrite"] as const;
export type NovelcrafterActionMode = (typeof NOVELCRAFTER_ACTION_MODES)[number];
export const NOVELCRAFTER_WRITE_MODES = [
  "auto",
  "guided",
  "tone_shift",
  "first_draft_rough",
  "openings_3",
] as const;
export type NovelcrafterWriteMode = (typeof NOVELCRAFTER_WRITE_MODES)[number];
export const NOVELCRAFTER_TONE_SHIFTS = [
  "ominous",
  "whimsical",
  "fast_paced",
  "intimate",
  "melancholic",
  "suspenseful",
  "humorous",
  "epic",
] as const;
export type NovelcrafterToneShift = (typeof NOVELCRAFTER_TONE_SHIFTS)[number];
export const NOVELCRAFTER_WRITE_LENGTH_OPTIONS = [150, 300, 600, 1000] as const;
export type NovelcrafterWriteLengthOption = (typeof NOVELCRAFTER_WRITE_LENGTH_OPTIONS)[number];
export const NOVELCRAFTER_REWRITE_MODES = [
  "rephrase",
  "shorter",
  "more_descriptive",
  "show_dont_tell",
  "more_inner_conflict",
  "more_intense",
  "custom",
] as const;
export type NovelcrafterRewriteMode = (typeof NOVELCRAFTER_REWRITE_MODES)[number];
export const NOVELCRAFTER_FEEDBACK_MODES = [
  "developmental",
  "line_editing",
  "dialogue",
  "copy_editing",
  "beta_read",
  "custom",
] as const;
export type NovelcrafterFeedbackMode = (typeof NOVELCRAFTER_FEEDBACK_MODES)[number];
export const NOVELCRAFTER_DEVELOPMENTAL_CRITERIA = [
  "consistency",
  "believability",
  "pacing",
  "clarity",
  "originality",
] as const;
export type NovelcrafterDevelopmentalCriterion =
  (typeof NOVELCRAFTER_DEVELOPMENTAL_CRITERIA)[number];
export const NOVELCRAFTER_EXPAND_MODES = ["expand", "describe"] as const;
export type NovelcrafterExpandMode = (typeof NOVELCRAFTER_EXPAND_MODES)[number];
export const NOVELCRAFTER_DESCRIBE_SENSES = [
  "sight",
  "sound",
  "smell",
  "taste",
  "touch",
  "metaphor",
] as const;
export type NovelcrafterDescribeSense = (typeof NOVELCRAFTER_DESCRIBE_SENSES)[number];
export const NOVELCRAFTER_BRAINSTORM_CATEGORIES = [
  "plot_twists",
  "character_names",
  "world_objects",
  "dialogue",
  "scene_ideas",
  "characters",
  "settings",
  "magic_systems",
  "conflicts",
  "titles",
] as const;
export type NovelcrafterBrainstormCategory = (typeof NOVELCRAFTER_BRAINSTORM_CATEGORIES)[number];
export const NOVELCRAFTER_STYLE_MODES = ["featured", "match", "custom"] as const;
export type NovelcrafterStyleMode = (typeof NOVELCRAFTER_STYLE_MODES)[number];
export const NOVELCRAFTER_POV_OPTIONS = [
  "first_person",
  "second_person",
  "third_person_limited",
  "third_person_omniscient",
  "third_person_objective",
] as const;
export type NovelcrafterPovOption = (typeof NOVELCRAFTER_POV_OPTIONS)[number];
export const NOVELCRAFTER_TENSE_OPTIONS = ["past", "present", "future"] as const;
export type NovelcrafterTenseOption = (typeof NOVELCRAFTER_TENSE_OPTIONS)[number];
export const MAX_CHAPTER_CONTEXT_CHARS = 8_000 as const;
export const MAX_PREVIOUS_CHAPTER_TAIL_CHARS = 2_000 as const;
export const MAX_HISTORY_CARDS = 50 as const;
export const MAX_CHAPTERS = 100 as const;
export const MAX_FEEDBACK_ITEMS_PER_CHAPTER = 50 as const;
export const MAX_CHARACTER_CARDS = 15 as const;
export const MAX_WORLD_ELEMENTS = 15 as const;
export const MAX_OUTLINE_ITEMS = 40 as const;

export const StoryBibleCharacterCardSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  role: z.string().max(150).default(""),
  traits: z.string().max(4_000).default(""),
  visibleToAI: z.boolean().default(true),
});
export type StoryBibleCharacterCard = z.infer<typeof StoryBibleCharacterCardSchema>;

export const StoryBibleWorldElementSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  category: z.string().max(100).default(""),
  description: z.string().max(4_000).default(""),
  visibleToAI: z.boolean().default(true),
});
export type StoryBibleWorldElement = z.infer<typeof StoryBibleWorldElementSchema>;

export const StoryBibleOutlineItemSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["act", "chapter"]).default("chapter"),
  title: z.string().min(1).max(200),
  summary: z.string().max(4_000).default(""),
  linkedChapterId: z.string().max(100).optional(),
});
export type StoryBibleOutlineItem = z.infer<typeof StoryBibleOutlineItemSchema>;

export const StoryBibleSchema = z.object({
  braindump: z.string().max(50_000).default(""),
  genre: z.string().max(2_000).default(""),
  style: z.string().max(10_000).default(""),
  styleMode: z.enum(NOVELCRAFTER_STYLE_MODES).default("custom"),
  pov: z.enum(NOVELCRAFTER_POV_OPTIONS).default("third_person_limited"),
  tense: z.enum(NOVELCRAFTER_TENSE_OPTIONS).default("past"),
  synopsis: z.string().max(30_000).default(""),
  characters: z.string().max(50_000).default(""),
  charactersVisibleToAI: z.boolean().default(true),
  characterCards: z.array(StoryBibleCharacterCardSchema).max(MAX_CHARACTER_CARDS).default([]),
  worldbuilding: z.string().max(50_000).default(""),
  worldbuildingVisibleToAI: z.boolean().default(true),
  worldElements: z.array(StoryBibleWorldElementSchema).max(MAX_WORLD_ELEMENTS).default([]),
  outline: z.string().max(50_000).default(""),
  outlineItems: z.array(StoryBibleOutlineItemSchema).max(MAX_OUTLINE_ITEMS).default([]),
});
export type StoryBible = z.infer<typeof StoryBibleSchema>;

export const NovelcrafterFeedbackItemSchema = z.object({
  id: z.string().min(1).max(100),
  category: z.string().min(1).max(80),
  quote: z.string().max(10_000).default(""),
  comment: z.string().min(1).max(10_000),
  suggestion: z.string().max(15_000).default(""),
  status: z.enum(["open", "resolved"]).default("open"),
  rating: z.enum(["up", "down"]).optional(),
  userReply: z.string().max(2_000).optional(),
  createdAt: z.number().int().nonnegative().default(0),
});
export type NovelcrafterFeedbackItem = z.infer<typeof NovelcrafterFeedbackItemSchema>;

export const NovelcrafterChapterSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  scenes: z.string().max(30_000).default(""),
  extraInstructions: z.string().max(4_000).default(""),
  content: z.string().max(150_000).default(""),
  feedbackItems: z
    .array(NovelcrafterFeedbackItemSchema)
    .max(MAX_FEEDBACK_ITEMS_PER_CHAPTER)
    .default([]),
  updatedAt: z.number().int().nonnegative(),
});
export type NovelcrafterChapter = z.infer<typeof NovelcrafterChapterSchema>;

export const NovelcrafterFeaturePersonasSchema = z.object({
  bible: z.string().min(1).max(100).default("inherit"),
  write: z.string().min(1).max(100).default("inherit"),
  rewrite: z.string().min(1).max(100).default("inherit"),
  feedback: z.string().min(1).max(100).default("inherit"),
  expand: z.string().min(1).max(100).default("inherit"),
  brainstorm: z.string().min(1).max(100).default("inherit"),
});
export type NovelcrafterFeaturePersonas = z.infer<typeof NovelcrafterFeaturePersonasSchema>;

export const NovelcrafterRoutingConfigSchema = z.object({
  masterGemId: z.string().max(100).nullable().default(null),
  masterPersonaId: z.string().max(100).nullable().default(null),
  featurePersonas: NovelcrafterFeaturePersonasSchema.default({
    bible: "inherit",
    write: "inherit",
    rewrite: "inherit",
    feedback: "inherit",
    expand: "inherit",
    brainstorm: "inherit",
  }),
});
export type NovelcrafterRoutingConfig = z.infer<typeof NovelcrafterRoutingConfigSchema>;

export const NOVELCRAFTER_FINISH_REASONS = [
  "stop",
  "length",
  "safety",
  "error",
  "aborted",
] as const;
export type NovelcrafterFinishReason = (typeof NOVELCRAFTER_FINISH_REASONS)[number];

export const NovelcrafterHistoryCardSchema = z.object({
  id: z.string().min(1).max(100),
  feature: z.enum(NOVELCRAFTER_HISTORY_CARD_FEATURE_SLOTS),
  subSlot: z.enum(NOVELCRAFTER_FEATURE_SLOTS).optional(),
  subLabel: z.string().max(200).optional(),
  actionLabel: z.string().max(200).optional(),
  bibleTarget: z.enum(NOVELCRAFTER_BIBLE_TARGETS).optional(),
  chapterId: z.string().max(100).optional(),
  content: z.string().max(150_000),
  thinking: z.string().max(100_000).optional(),
  model: z.string().max(100),
  routedModel: z.string().max(150).optional(),
  finishReason: z.enum(NOVELCRAFTER_FINISH_REASONS).optional(),
  gemName: z.string().max(200).nullable().optional(),
  personaName: z.string().max(200).nullable().optional(),
  createdAt: z.number().int().nonnegative(),
});
export type NovelcrafterHistoryCard = z.infer<typeof NovelcrafterHistoryCardSchema>;

export const NovelcrafterStoryStateSchema = z.object({
  version: z.number().int().nonnegative(),
  selectedModel: z.string().min(1).max(100),
  isStoryBibleOpen: z.boolean().default(true),
  activeChapterId: z.string().min(1).max(100),
  storyBible: StoryBibleSchema,
  chapters: z.array(NovelcrafterChapterSchema).min(1).max(MAX_CHAPTERS),
  routing: NovelcrafterRoutingConfigSchema,
  historyCards: z.array(NovelcrafterHistoryCardSchema).max(MAX_HISTORY_CARDS),
  updatedAt: z.number().int().nonnegative(),
});
export type NovelcrafterStoryState = z.infer<typeof NovelcrafterStoryStateSchema>;

export const NovelcrafterPutStateRequestSchema = z.object({
  conversationId: z.string().regex(UUID_REGEX, "Invalid conversationId"),
  state: NovelcrafterStoryStateSchema,
  allowDestructive: z.boolean().optional().default(false),
});
export type NovelcrafterPutStateRequest = z.infer<typeof NovelcrafterPutStateRequestSchema>;

export interface BuildUserPromptInput {
  feature: NovelcrafterFeatureSlot;
  storyBible: StoryBible;
  chapterTitle?: string;
  chapterScenes?: string;
  chapterExtraInstructions?: string;
  chapterProse?: string;
  previousChapterProseTail?: string;
  selectedText?: string;
  bibleTarget?: NovelcrafterBibleTarget;
  actionMode?: NovelcrafterActionMode;
  writeMode?: NovelcrafterWriteMode;
  toneShift?: NovelcrafterToneShift;
  writeLengthWords?: number;
  keyDetails?: string;
  rewriteMode?: NovelcrafterRewriteMode;
  feedbackMode?: NovelcrafterFeedbackMode;
  feedbackCriteria?: NovelcrafterDevelopmentalCriterion[];
  expandMode?: NovelcrafterExpandMode;
  describeSenses?: NovelcrafterDescribeSense[];
  brainstormCategory?: NovelcrafterBrainstormCategory;
  customInstruction?: string;
}

export const NovelcrafterStreamRequestSchema = z
  .object({
    conversationId: z.string().regex(UUID_REGEX, "Invalid conversationId"),
    model: z.string().min(1).max(100),
    feature: z.enum(NOVELCRAFTER_FEATURE_SLOTS),
    routing: NovelcrafterRoutingConfigSchema,
    storyBible: StoryBibleSchema,
    chapterTitle: z.string().max(200).optional().default(""),
    chapterScenes: z.string().max(30_000).optional().default(""),
    chapterExtraInstructions: z.string().max(4_000).optional().default(""),
    chapterProse: z.string().max(150_000).optional().default(""),
    previousChapterProseTail: z.string().max(10_000).optional().default(""),
    selectedText: z.string().max(20_000).optional().default(""),
    bibleTarget: z.enum(NOVELCRAFTER_BIBLE_TARGETS).optional(),
    actionMode: z.enum(NOVELCRAFTER_ACTION_MODES).optional().default("generate"),
    writeMode: z.enum(NOVELCRAFTER_WRITE_MODES).optional().default("auto"),
    toneShift: z.enum(NOVELCRAFTER_TONE_SHIFTS).optional(),
    writeLengthWords: z.number().int().min(50).max(4000).optional(),
    keyDetails: z.string().max(4_000).optional().default(""),
    rewriteMode: z.enum(NOVELCRAFTER_REWRITE_MODES).optional().default("rephrase"),
    feedbackMode: z.enum(NOVELCRAFTER_FEEDBACK_MODES).optional().default("developmental"),
    feedbackCriteria: z.array(z.enum(NOVELCRAFTER_DEVELOPMENTAL_CRITERIA)).max(5).optional(),
    expandMode: z.enum(NOVELCRAFTER_EXPAND_MODES).optional().default("expand"),
    describeSenses: z.array(z.enum(NOVELCRAFTER_DESCRIBE_SENSES)).max(6).optional(),
    brainstormCategory: z
      .enum(NOVELCRAFTER_BRAINSTORM_CATEGORIES)
      .optional()
      .default("plot_twists"),
    customInstruction: z.string().max(5_000).optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.feature === "bible" && !val.bibleTarget) {
      ctx.addIssue({
        code: "custom",
        path: ["bibleTarget"],
        message: "bibleTarget is required when feature is 'bible'",
      });
    }
    if ((val.feature === "rewrite" || val.feature === "expand") && !val.selectedText.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedText"],
        message: "selectedText is required when feature is 'rewrite' or 'expand'",
      });
    }
    if (val.feature === "feedback" && !val.chapterProse.trim() && !val.selectedText.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["chapterProse"],
        message: "chapterProse or selectedText is required when feature is 'feedback'",
      });
    }
  });
export type NovelcrafterStreamRequest = z.infer<typeof NovelcrafterStreamRequestSchema>;

export function createDefaultStoryState(defaultChapterTitle = "Chapter 1"): NovelcrafterStoryState {
  const now = Date.now();
  const chapterId = "ch-1";
  return {
    version: 1,
    selectedModel: DEFAULT_MODEL,
    isStoryBibleOpen: true,
    activeChapterId: chapterId,
    storyBible: {
      braindump: "",
      genre: "",
      style: "",
      styleMode: "custom",
      pov: "third_person_limited",
      tense: "past",
      synopsis: "",
      characters: "",
      charactersVisibleToAI: true,
      characterCards: [],
      worldbuilding: "",
      worldbuildingVisibleToAI: true,
      worldElements: [],
      outline: "",
      outlineItems: [],
    },
    chapters: [
      {
        id: chapterId,
        title: defaultChapterTitle,
        scenes: "",
        extraInstructions: "",
        content: "",
        feedbackItems: [],
        updatedAt: now,
      },
    ],
    routing: {
      masterGemId: null,
      masterPersonaId: null,
      featurePersonas: {
        bible: "inherit",
        write: "inherit",
        rewrite: "inherit",
        feedback: "inherit",
        expand: "inherit",
        brainstorm: "inherit",
      },
    },
    historyCards: [],
    updatedAt: now,
  };
}
