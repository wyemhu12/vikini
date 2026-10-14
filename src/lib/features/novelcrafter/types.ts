// /lib/features/novelcrafter/types.ts
// Domain types, constants, and Zod v4 schemas for Novelcrafter Studio

import { z } from "zod";
import { DEFAULT_MODEL } from "@/lib/core/modelRegistry";
import { UUID_REGEX } from "@/lib/utils/constants";

export const NOVELCRAFTER_FEATURE_SLOTS = [
  "bible",
  "write",
  "rewrite",
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

export const NOVELCRAFTER_WRITE_MODES = ["auto", "guided"] as const;
export type NovelcrafterWriteMode = (typeof NOVELCRAFTER_WRITE_MODES)[number];

export const NOVELCRAFTER_REWRITE_MODES = [
  "rephrase",
  "shorter",
  "more_descriptive",
  "show_dont_tell",
  "more_inner_conflict",
  "custom",
] as const;
export type NovelcrafterRewriteMode = (typeof NOVELCRAFTER_REWRITE_MODES)[number];

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
] as const;
export type NovelcrafterBrainstormCategory = (typeof NOVELCRAFTER_BRAINSTORM_CATEGORIES)[number];

export const MAX_CHAPTER_CONTEXT_CHARS = 8_000 as const;
export const MAX_PREVIOUS_CHAPTER_TAIL_CHARS = 2_000 as const;
export const MAX_HISTORY_CARDS = 50 as const;
export const MAX_CHAPTERS = 100 as const;

export const StoryBibleSchema = z.object({
  braindump: z.string().max(50_000).default(""),
  genre: z.string().max(2_000).default(""),
  style: z.string().max(10_000).default(""),
  synopsis: z.string().max(30_000).default(""),
  characters: z.string().max(50_000).default(""),
  charactersVisibleToAI: z.boolean().default(true),
  worldbuilding: z.string().max(50_000).default(""),
  worldbuildingVisibleToAI: z.boolean().default(true),
  outline: z.string().max(50_000).default(""),
});

export type StoryBible = z.infer<typeof StoryBibleSchema>;

export const NovelcrafterChapterSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  scenes: z.string().max(30_000).default(""),
  content: z.string().max(150_000).default(""),
  updatedAt: z.number().int().nonnegative(),
});

export type NovelcrafterChapter = z.infer<typeof NovelcrafterChapterSchema>;

export const NovelcrafterFeaturePersonasSchema = z.object({
  bible: z.string().min(1).max(100).default("inherit"),
  write: z.string().min(1).max(100).default("inherit"),
  rewrite: z.string().min(1).max(100).default("inherit"),
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
    expand: "inherit",
    brainstorm: "inherit",
  }),
});

export type NovelcrafterRoutingConfig = z.infer<typeof NovelcrafterRoutingConfigSchema>;

export const NovelcrafterHistoryCardSchema = z.object({
  id: z.string().min(1).max(100),
  feature: z.enum(NOVELCRAFTER_FEATURE_SLOTS),
  subLabel: z.string().max(200).optional(),
  bibleTarget: z.enum(NOVELCRAFTER_BIBLE_TARGETS).optional(),
  chapterId: z.string().max(100).optional(),
  content: z.string().max(150_000),
  thinking: z.string().max(100_000).optional(),
  model: z.string().max(100),
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
});

export type NovelcrafterPutStateRequest = z.infer<typeof NovelcrafterPutStateRequestSchema>;

export const NovelcrafterStreamRequestSchema = z
  .object({
    conversationId: z.string().regex(UUID_REGEX, "Invalid conversationId"),
    model: z.string().min(1).max(100),
    feature: z.enum(NOVELCRAFTER_FEATURE_SLOTS),
    routing: NovelcrafterRoutingConfigSchema,
    storyBible: StoryBibleSchema,
    chapterTitle: z.string().max(200).optional().default(""),
    chapterScenes: z.string().max(30_000).optional().default(""),
    chapterProse: z.string().max(150_000).optional().default(""),
    previousChapterProseTail: z.string().max(10_000).optional().default(""),
    selectedText: z.string().max(20_000).optional().default(""),
    bibleTarget: z.enum(NOVELCRAFTER_BIBLE_TARGETS).optional(),
    actionMode: z.enum(NOVELCRAFTER_ACTION_MODES).optional().default("generate"),
    writeMode: z.enum(NOVELCRAFTER_WRITE_MODES).optional().default("auto"),
    rewriteMode: z.enum(NOVELCRAFTER_REWRITE_MODES).optional().default("rephrase"),
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
      synopsis: "",
      characters: "",
      charactersVisibleToAI: true,
      worldbuilding: "",
      worldbuildingVisibleToAI: true,
      outline: "",
    },
    chapters: [
      {
        id: chapterId,
        title: defaultChapterTitle,
        scenes: "",
        content: "",
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
        expand: "inherit",
        brainstorm: "inherit",
      },
    },
    historyCards: [],
    updatedAt: now,
  };
}
