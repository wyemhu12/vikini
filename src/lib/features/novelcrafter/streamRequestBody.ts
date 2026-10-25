// /lib/features/novelcrafter/streamRequestBody.ts
// Pure builder for POST /api/novelcrafter/stream request body with Prompt Studio overrides

import type { NovelcrafterContextNode } from "./contextNodes";
import { resolveEffectiveContextNodes, resolvePromptActionKey } from "./promptActions";
import { buildActiveCodexContextText } from "./promptBuilder";
import {
  buildStreamPromptOverridePayload,
  type PromptStudioSettings,
} from "./promptStudioSettings";
import { pruneStoryBibleForStream } from "./pruneStoryBibleForStream";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
  NovelcrafterBrainstormCategory,
  NovelcrafterDescribeSense,
  NovelcrafterDevelopmentalCriterion,
  NovelcrafterExpandMode,
  NovelcrafterFeatureSlot,
  NovelcrafterFeedbackMode,
  NovelcrafterRewriteMode,
  NovelcrafterRoutingConfig,
  NovelcrafterToneShift,
  NovelcrafterWriteMode,
  StoryBible,
} from "./types";

export interface StreamBodyTriggerParams {
  feature: NovelcrafterFeatureSlot;
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
  selectedText?: string;
}

export interface StreamBodyContextOptions {
  selectedModel: string;
  routing: NovelcrafterRoutingConfig;
  storyBible: StoryBible;
  chapterTitle: string;
  chapterScenes: string;
  chapterExtraInstructions?: string;
  chapterSummary?: string;
  chapterProse: string;
  previousChapterProseTail: string;
  previousChapterSummaries?: string;
}

export interface BuildStreamRequestBodyInput {
  conversationId: string;
  options: StreamBodyContextOptions;
  params: StreamBodyTriggerParams;
  promptSettings?: PromptStudioSettings;
}

export interface NovelcrafterStreamRequestBody {
  conversationId: string;
  model: string;
  feature: NovelcrafterFeatureSlot;
  routing: NovelcrafterRoutingConfig;
  storyBible: StoryBible;
  chapterTitle: string;
  chapterScenes: string;
  chapterExtraInstructions: string;
  chapterSummary: string;
  chapterProse: string;
  previousChapterProseTail: string;
  previousChapterSummaries: string;
  selectedText: string;
  bibleTarget?: NovelcrafterBibleTarget;
  actionMode: NovelcrafterActionMode;
  writeMode: NovelcrafterWriteMode;
  toneShift?: NovelcrafterToneShift;
  writeLengthWords?: number;
  keyDetails?: string;
  rewriteMode: NovelcrafterRewriteMode;
  feedbackMode: NovelcrafterFeedbackMode;
  feedbackCriteria?: NovelcrafterDevelopmentalCriterion[];
  expandMode: NovelcrafterExpandMode;
  describeSenses?: NovelcrafterDescribeSense[];
  brainstormCategory: NovelcrafterBrainstormCategory;
  customInstruction: string;
  promptDirectiveOverride?: string;
  contextNodes?: NovelcrafterContextNode[];
}

export function buildNovelcrafterStreamRequestBody({
  conversationId,
  options: opts,
  params,
  promptSettings,
}: BuildStreamRequestBodyInput): NovelcrafterStreamRequestBody {
  const actionKey = resolvePromptActionKey(params);
  const rawOverride = promptSettings
    ? buildStreamPromptOverridePayload(actionKey, promptSettings)
    : {};
  const isBibleRewrite = params.feature === "bible" && params.actionMode === "rewrite";
  const promptDirectiveOverride = isBibleRewrite ? undefined : rawOverride.promptDirectiveOverride;
  const contextNodes = rawOverride.contextNodes;

  const effectiveNodes =
    actionKey && contextNodes !== undefined
      ? resolveEffectiveContextNodes(actionKey, contextNodes)
      : undefined;

  const activeContextText = buildActiveCodexContextText({
    feature: params.feature,
    storyBible: opts.storyBible,
    chapterTitle: opts.chapterTitle,
    chapterScenes: opts.chapterScenes,
    chapterSummary: opts.chapterSummary,
    chapterExtraInstructions: opts.chapterExtraInstructions,
    chapterProse: opts.chapterProse,
    selectedText: params.selectedText,
    keyDetails: params.keyDetails,
    customInstruction: params.customInstruction,
  });

  const prunedBible = pruneStoryBibleForStream(
    opts.storyBible,
    params.feature,
    params.bibleTarget,
    activeContextText,
    params.writeMode,
    effectiveNodes
  );

  return {
    conversationId,
    model: opts.selectedModel,
    feature: params.feature,
    routing: opts.routing,
    storyBible: prunedBible,
    chapterTitle: opts.chapterTitle,
    chapterScenes: opts.chapterScenes,
    chapterExtraInstructions: opts.chapterExtraInstructions || "",
    chapterSummary: opts.chapterSummary || "",
    chapterProse: opts.chapterProse,
    previousChapterProseTail: opts.previousChapterProseTail,
    previousChapterSummaries: opts.previousChapterSummaries || "",
    selectedText: params.selectedText || "",
    bibleTarget: params.bibleTarget,
    actionMode: params.actionMode || "generate",
    writeMode: params.writeMode || "auto",
    toneShift: params.toneShift,
    writeLengthWords: params.writeLengthWords,
    keyDetails: params.keyDetails,
    rewriteMode: params.rewriteMode || "rephrase",
    feedbackMode: params.feedbackMode || "developmental",
    feedbackCriteria: params.feedbackCriteria,
    expandMode: params.expandMode || "expand",
    describeSenses: params.describeSenses,
    brainstormCategory: params.brainstormCategory || "plot_twists",
    customInstruction: params.customInstruction || "",
    ...(promptDirectiveOverride ? { promptDirectiveOverride } : {}),
    ...(contextNodes ? { contextNodes } : {}),
  };
}
