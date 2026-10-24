// /app/features/novelcrafter/hooks/useNovelcrafterStream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  createRafStreamBatcher,
  useNovelcrafterStreamStore,
} from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import { buildActiveCodexContextText } from "@/lib/features/novelcrafter/promptBuilder";
import { pruneStoryBibleForStream } from "@/lib/features/novelcrafter/pruneStoryBibleForStream";
import {
  NovelcrafterStreamRunRegistry,
  shouldAbortStreamOnConversationChange,
} from "@/lib/features/novelcrafter/streamRunRegistry";
import {
  isLikelyModelRefusalOutput,
  resolveStreamCloseOutcome,
  type StreamTerminationReason,
} from "@/lib/features/novelcrafter/streamTargetGuard";
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
import { hasActiveOverlayInDom, shouldCancelStreamOnEscape } from "../utils/novelcrafterKeyboard";
import {
  parseFinishReason,
  parseNovelcrafterSseFrame,
  readNovelcrafterSseStream,
} from "../utils/novelcrafterSseParser";

const streamHookLogger = logger.withContext("useNovelcrafterStream");

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

interface UseNovelcrafterStreamOptions {
  selectedConversationId: string | null;
  ensureStoryConversation: () => Promise<string | null>;
  selectedModel: string;
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

export function useNovelcrafterStream(options: UseNovelcrafterStreamOptions) {
  const { selectedConversationId } = options;
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const registryRef = useRef<NovelcrafterStreamRunRegistry | null>(null);
  if (!registryRef.current) registryRef.current = new NovelcrafterStreamRunRegistry();
  const registry = registryRef.current;
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevConversationIdRef = useRef<string | null>(selectedConversationId);
  const isPromotingStoryRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingMeta, setStreamingMeta] = useState<StreamingCardMeta | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const activeRunId = registry.getActiveRunId();
    if (activeRunId) {
      registry.endRun(activeRunId);
      useNovelcrafterStreamStore.getState().finishStreamRun(activeRunId);
    }
    setIsStreaming(false);
  }, [registry]);

  useEffect(() => {
    const prevStoryId = prevConversationIdRef.current;
    prevConversationIdRef.current = selectedConversationId;
    const activeRunId = registry.getActiveRunId();
    const activeTargetStoryId = activeRunId
      ? registry.getTarget(activeRunId)?.targetStoryId
      : undefined;

    if (
      shouldAbortStreamOnConversationChange({
        prevStoryId,
        nextStoryId: selectedConversationId,
        activeTargetStoryId,
        isPromotingPendingStory: isPromotingStoryRef.current,
      })
    ) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      registry.reset();
      useNovelcrafterStreamStore.getState().resetStreamStore();
      setIsStreaming(false);
    }
  }, [selectedConversationId, registry]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      registry.reset();
      useNovelcrafterStreamStore.getState().resetStreamStore();
    };
  }, [registry]);

  useEffect(() => {
    if (!isStreaming) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        shouldCancelStreamOnEscape({
          key: e.key,
          defaultPrevented: e.defaultPrevented,
          isStreaming,
          hasOpenModalOrPopover: hasActiveOverlayInDom(),
        })
      ) {
        e.preventDefault();
        stopStream();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, stopStream]);

  const triggerStream = useCallback(
    async (params: TriggerNovelcrafterStreamParams) => {
      const opts = optionsRef.current;
      abortControllerRef.current?.abort();
      const prevRunId = registry.getActiveRunId();
      if (prevRunId) registry.endRun(prevRunId);

      const runId = registry.startRun({
        targetStoryId: opts.selectedConversationId,
        targetChapterId: opts.activeChapterId,
        feature: params.feature,
        bibleTarget: params.bibleTarget,
        subLabel: params.subLabel,
      });
      if (!runId) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const initialMeta: StreamingCardMeta = {
        model: opts.selectedModel,
        gemName: null,
        personaName: null,
        feature: params.feature,
        subLabel: params.subLabel,
        bibleTarget: params.bibleTarget,
      };
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingThinking("");
      setStreamingMeta(initialMeta);
      useNovelcrafterStreamStore.getState().beginStreamRun(runId, initialMeta);

      let targetConversationId: string | null = opts.selectedConversationId;
      if (!targetConversationId) {
        try {
          isPromotingStoryRef.current = true;
          targetConversationId = await opts.ensureStoryConversation();
          if (targetConversationId) {
            registry.promotePendingRunStory(runId, targetConversationId);
          }
        } catch (err: unknown) {
          streamHookLogger.error("Failed to ensure story conversation:", err);
          targetConversationId = null;
        } finally {
          isPromotingStoryRef.current = false;
        }
      } else {
        registry.promotePendingRunStory(runId, targetConversationId);
      }

      if (
        !targetConversationId ||
        controller.signal.aborted ||
        registry.getActiveRunId() !== runId
      ) {
        const wasCurrentRun = registry.endRun(runId);
        if (wasCurrentRun || !registry.isBusy()) {
          setIsStreaming(false);
          useNovelcrafterStreamStore.getState().finishStreamRun(runId);
        }
        return;
      }

      const batcher = createRafStreamBatcher(runId, (rId, content, thinking) => {
        if (registry.getActiveRunId() !== rId) return;
        useNovelcrafterStreamStore.getState().flushStreamSnapshot(rId, content, thinking);
        setStreamingContent(content);
        setStreamingThinking(thinking);
        opts.onStreamTokenChunk?.({ storyId: targetConversationId, fullContent: content, params });
      });
      opts.onStreamStarted?.({ storyId: targetConversationId, params });

      let fullContent = "";
      let fullThinking = "";
      let resolvedGemName: string | null = null;
      let resolvedPersonaName: string | null = null;
      let resolvedModel = opts.selectedModel;
      let routedModel: string | undefined;
      let finishReason: NovelcrafterFinishReason | undefined;
      let sawDoneEvent = false;
      let terminationReason: StreamTerminationReason = "completed";
      let pendingErrorToast: string | null = null;
      let pendingWarningToast: string | null = null;

      const processFrame = (frame: string) => {
        const parsed = parseNovelcrafterSseFrame(frame);
        if (!parsed) return;
        const { eventType, parsedData } = parsed;
        if (eventType === "meta") {
          resolvedModel =
            typeof parsedData.model === "string" ? parsedData.model : opts.selectedModel;
          routedModel =
            typeof parsedData.routedModel === "string" && parsedData.routedModel.trim()
              ? parsedData.routedModel.trim()
              : undefined;
          resolvedGemName = typeof parsedData.gemName === "string" ? parsedData.gemName : null;
          resolvedPersonaName =
            typeof parsedData.personaName === "string" ? parsedData.personaName : null;
          if (registry.getActiveRunId() === runId) {
            const nextMeta: StreamingCardMeta = {
              model: resolvedModel,
              routedModel,
              gemName: resolvedGemName,
              personaName: resolvedPersonaName,
              feature: params.feature,
              subLabel: params.subLabel,
              bibleTarget: params.bibleTarget,
            };
            setStreamingMeta(nextMeta);
            useNovelcrafterStreamStore.getState().updateStreamMeta(runId, nextMeta);
          }
        } else if (eventType === "thinking") {
          const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
          if (tChunk) {
            fullThinking += tChunk;
            batcher.scheduleUpdate(fullContent, fullThinking);
          }
        } else if (eventType === "token") {
          const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
          if (tChunk) {
            fullContent += tChunk;
            batcher.scheduleUpdate(fullContent, fullThinking);
          }
        } else if (eventType === "done") {
          sawDoneEvent = true;
          finishReason = parseFinishReason(parsedData.finishReason) ?? finishReason;
        } else if (eventType === "error") {
          throw new Error(
            typeof parsedData.message === "string" ? parsedData.message : "Stream error occurred"
          );
        }
      };

      try {
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
          params.writeMode
        );
        const res = await fetch("/api/novelcrafter/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: targetConversationId,
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
          }),
        });
        if (!res.ok || !res.body) {
          const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(errJson.error?.message || `HTTP ${res.status}`);
        }
        await readNovelcrafterSseStream(res.body, processFrame);
        const closure = resolveStreamCloseOutcome({
          sawDoneEvent,
          aborted: controller.signal.aborted,
          finishReason,
        });
        finishReason = closure.finishReason;
        if (closure.closedWithoutDone) {
          pendingWarningToast = opts.streamCutoffWarning ?? null;
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          terminationReason = "stopped";
          finishReason = "aborted";
        } else {
          terminationReason = "error";
          finishReason = "error";
          const msg = err instanceof Error ? err.message : "Failed to run AI tool";
          streamHookLogger.error("Novelcrafter stream failed:", msg);
          pendingErrorToast = msg;
        }
      } finally {
        batcher.flushNow();
        const wasCurrentRun = registry.endRun(runId);
        if (wasCurrentRun || !registry.isBusy()) {
          setIsStreaming(false);
          useNovelcrafterStreamStore.getState().finishStreamRun(runId);
        }
        if (controller.signal.aborted && terminationReason === "completed") {
          terminationReason = "stopped";
          finishReason = "aborted";
        }
        if (wasCurrentRun) {
          const termResult = opts.onStreamTerminated?.({
            storyId: targetConversationId,
            reason: terminationReason,
            fullContent,
            fullThinking,
            resolvedModel,
            routedModel,
            finishReason,
            resolvedGemName,
            resolvedPersonaName,
            params,
          });
          if (pendingErrorToast && !termResult?.handledRefusal) {
            toast.error(pendingErrorToast);
          }
          if (pendingWarningToast && !termResult?.handledRefusal) {
            toast.warning(pendingWarningToast);
          }
          if (
            fullContent.trim().length > 0 &&
            !termResult?.handledRefusal &&
            !isLikelyModelRefusalOutput(fullContent)
          ) {
            const cardFeature: NovelcrafterHistoryCard["feature"] =
              params.feature === "feedback" ? "rewrite" : params.feature;
            opts.onCardCompleted({
              id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              feature: cardFeature,
              subSlot: params.feature === "feedback" ? "feedback" : undefined,
              actionLabel: params.subLabel,
              subLabel: params.subLabel,
              bibleTarget: params.bibleTarget,
              chapterId: opts.activeChapterId,
              content: fullContent.trim(),
              thinking: fullThinking.trim() || undefined,
              model: resolvedModel,
              ...(routedModel ? { routedModel } : {}),
              ...(finishReason ? { finishReason } : {}),
              gemName: resolvedGemName,
              personaName: resolvedPersonaName,
              createdAt: Date.now(),
            });
          }
        }
      }
    },
    [registry]
  );

  return {
    isStreaming,
    streamingContent,
    streamingThinking,
    streamingMeta,
    triggerStream,
    stopStream,
  };
}
