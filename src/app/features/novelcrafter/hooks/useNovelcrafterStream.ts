// /app/features/novelcrafter/hooks/useNovelcrafterStream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRafStreamBatcher,
  useNovelcrafterStreamStore,
} from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import { resolveEffectiveSlotModel } from "@/lib/features/novelcrafter/aiInheritanceTable";
import { NovelcrafterStreamRunRegistry } from "@/lib/features/novelcrafter/streamRunRegistry";
import {
  createInitialStreamingMeta,
  finalizeNovelcrafterStreamRun,
  resolveNovelcrafterTargetStory,
  runNovelcrafterSseStream,
} from "../utils/novelcrafterStreamHelpers";
import type {
  StreamingCardMeta,
  StreamTerminatedPayload,
  TriggerNovelcrafterStreamParams,
  UseNovelcrafterStreamOptions,
} from "../utils/novelcrafterStreamTypes";
import { useNovelcrafterStreamGuards } from "./useNovelcrafterStreamGuards";

export type {
  TriggerNovelcrafterStreamParams,
  StreamingCardMeta,
  StreamTerminatedPayload,
  UseNovelcrafterStreamOptions,
};

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

  const { stopStream } = useNovelcrafterStreamGuards({
    selectedConversationId,
    isStreaming,
    setIsStreaming,
    registry,
    abortControllerRef,
    prevConversationIdRef,
    isPromotingStoryRef,
  });

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

      const effectiveSlotModel = resolveEffectiveSlotModel(
        params.feature,
        opts.selectedModel,
        opts.routing,
        opts.allowedModelIds
      ).modelId;
      const initialMeta = createInitialStreamingMeta(effectiveSlotModel, params);
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingThinking("");
      setStreamingMeta(initialMeta);
      useNovelcrafterStreamStore.getState().beginStreamRun(runId, initialMeta);

      const targetConversationId = await resolveNovelcrafterTargetStory({
        runId,
        initialStoryId: opts.selectedConversationId,
        ensureStoryConversation: opts.ensureStoryConversation,
        registry,
        isPromotingStoryRef,
      });
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

      const result = await runNovelcrafterSseStream({
        runId,
        targetConversationId,
        effectiveSlotModel,
        controller,
        options: opts,
        triggerParams: params,
        registry,
        batcher,
        onMetaUpdated: setStreamingMeta,
      });

      finalizeNovelcrafterStreamRun({
        runId,
        targetConversationId,
        controller,
        registry,
        batcher,
        options: opts,
        triggerParams: params,
        result,
        setIsStreaming,
      });
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
