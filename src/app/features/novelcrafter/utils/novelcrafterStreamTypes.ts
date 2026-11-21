// /app/features/novelcrafter/utils/novelcrafterStreamTypes.ts
// Shared TypeScript interfaces for Novelcrafter streaming hooks and helpers

import type { StreamTerminationReason } from "@/lib/features/novelcrafter/streamTargetGuard";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
  NovelcrafterBrainstormCategory,
  NovelcrafterDescribeSense,
  NovelcrafterDevelopmentalCriterion,
  NovelcrafterExpandMode,
  NovelcrafterFeatureSlot,
  NovelcrafterFeedbackMode,
  NovelcrafterFinishReason,
  NovelcrafterHistoryCard,
  NovelcrafterRewriteMode,
  NovelcrafterRoutingConfig,
  NovelcrafterToneShift,
  NovelcrafterWriteMode,
  StoryBible,
} from "@/lib/features/novelcrafter/types";

export interface TriggerNovelcrafterStreamParams {
  feature: NovelcrafterFeatureSlot;
  subLabel?: string;
  bibleTarget?: NovelcrafterBibleTarget;
  actionMode?: NovelcrafterActionMode;
  writeMode?: NovelcrafterWriteMode;
  toneShift?: NovelcrafterToneShift;
  writeLengthWords?: number;
  keyDetails?: string;
  rewriteMode?: NovelcrafterRewriteMode;
  feedbackMode?: NovelcrafterFeedbackMode;
  feedbackCriteria?: NovelcrafterDevelopmentalCriterion[];
  replyToFeedbackId?: string;
  expandMode?: NovelcrafterExpandMode;
  describeSenses?: NovelcrafterDescribeSense[];
  brainstormCategory?: NovelcrafterBrainstormCategory;
  customInstruction?: string;
  selectedText?: string;
}

export interface StreamingCardMeta {
  model: string;
  routedModel?: string;
  gemName: string | null;
  personaName: string | null;
  feature: NovelcrafterFeatureSlot;
  subLabel?: string;
  bibleTarget?: NovelcrafterBibleTarget;
}

export interface StreamTerminatedPayload {
  storyId: string;
  reason: StreamTerminationReason;
  fullContent: string;
  fullThinking: string;
  resolvedModel: string;
  routedModel?: string;
  finishReason?: NovelcrafterFinishReason;
  resolvedGemName: string | null;
  resolvedPersonaName: string | null;
  params: TriggerNovelcrafterStreamParams;
}

export interface UseNovelcrafterStreamOptions {
  selectedConversationId: string | null;
  ensureStoryConversation: () => Promise<string | null>;
  selectedModel: string;
  allowedModelIds?: ReadonlySet<string>;
  routing: NovelcrafterRoutingConfig;
  storyBible: StoryBible;
  activeChapterId: string;
  chapterTitle: string;
  chapterScenes: string;
  chapterExtraInstructions?: string;
  chapterSummary?: string;
  chapterProse: string;
  previousChapterProseTail: string;
  previousChapterSummaries?: string;
  streamCutoffWarning?: string;
  onStreamStarted?: (payload: { storyId: string; params: TriggerNovelcrafterStreamParams }) => void;
  onStreamTokenChunk?: (payload: {
    storyId: string;
    fullContent: string;
    params: TriggerNovelcrafterStreamParams;
  }) => void;
  onStreamTerminated?: (payload: StreamTerminatedPayload) => { handledRefusal?: boolean } | void;
  onCardCompleted: (card: NovelcrafterHistoryCard) => void;
}
