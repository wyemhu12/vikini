// /app/features/novelcrafter/hooks/useNovelcrafterStream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import type {
  NovelcrafterActionMode,
  NovelcrafterBibleTarget,
  NovelcrafterBrainstormCategory,
  NovelcrafterDescribeSense,
  NovelcrafterExpandMode,
  NovelcrafterFeatureSlot,
  NovelcrafterHistoryCard,
  NovelcrafterRewriteMode,
  NovelcrafterRoutingConfig,
  NovelcrafterWriteMode,
  StoryBible,
} from "@/lib/features/novelcrafter/types";

const streamHookLogger = logger.withContext("useNovelcrafterStream");

export interface TriggerNovelcrafterStreamParams {
  feature: NovelcrafterFeatureSlot;
  subLabel?: string;
  bibleTarget?: NovelcrafterBibleTarget;
  actionMode?: NovelcrafterActionMode;
  writeMode?: NovelcrafterWriteMode;
  rewriteMode?: NovelcrafterRewriteMode;
  expandMode?: NovelcrafterExpandMode;
  describeSenses?: NovelcrafterDescribeSense[];
  brainstormCategory?: NovelcrafterBrainstormCategory;
  customInstruction?: string;
  selectedText?: string;
}

export interface StreamingCardMeta {
  model: string;
  gemName: string | null;
  personaName: string | null;
  feature: NovelcrafterFeatureSlot;
  subLabel?: string;
  bibleTarget?: NovelcrafterBibleTarget;
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
  chapterProse: string;
  previousChapterProseTail: string;
  onCardCompleted: (card: NovelcrafterHistoryCard) => void;
}

export function useNovelcrafterStream({
  selectedConversationId,
  ensureStoryConversation,
  selectedModel,
  routing,
  storyBible,
  activeChapterId,
  chapterTitle,
  chapterScenes,
  chapterProse,
  previousChapterProseTail,
  onCardCompleted,
}: UseNovelcrafterStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingMeta, setStreamingMeta] = useState<StreamingCardMeta | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Abort active stream if user switches stories or unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedConversationId]);

  const triggerStream = useCallback(
    async (params: TriggerNovelcrafterStreamParams) => {
      stopStream();

      let targetConversationId = selectedConversationId;
      if (!targetConversationId) {
        targetConversationId = await ensureStoryConversation();
      }
      if (!targetConversationId) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setStreamingContent("");
      setStreamingThinking("");
      setStreamingMeta({
        model: selectedModel,
        gemName: null,
        personaName: null,
        feature: params.feature,
        subLabel: params.subLabel,
        bibleTarget: params.bibleTarget,
      });

      let fullContent = "";
      let fullThinking = "";
      let resolvedGemName: string | null = null;
      let resolvedPersonaName: string | null = null;
      let resolvedModel = selectedModel;

      try {
        const res = await fetch("/api/novelcrafter/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: targetConversationId,
            model: selectedModel,
            feature: params.feature,
            routing,
            storyBible,
            chapterTitle,
            chapterScenes,
            chapterProse,
            previousChapterProseTail,
            selectedText: params.selectedText || "",
            bibleTarget: params.bibleTarget,
            actionMode: params.actionMode || "generate",
            writeMode: params.writeMode || "auto",
            rewriteMode: params.rewriteMode || "rephrase",
            expandMode: params.expandMode || "expand",
            describeSenses: params.describeSenses,
            brainstormCategory: params.brainstormCategory || "plot_twists",
            customInstruction: params.customInstruction || "",
          }),
        });

        if (!res.ok || !res.body) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(errJson.error?.message || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() || "";

          for (const frame of frames) {
            const lines = frame.split("\n");
            let eventType = "message";
            let dataRaw = "";

            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataRaw += line.slice(5).trim();
              }
            }

            if (!dataRaw) continue;
            let parsedData: Record<string, unknown>;
            try {
              parsedData = JSON.parse(dataRaw) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (eventType === "meta") {
              resolvedModel =
                typeof parsedData.model === "string" ? parsedData.model : selectedModel;
              resolvedGemName = typeof parsedData.gemName === "string" ? parsedData.gemName : null;
              resolvedPersonaName =
                typeof parsedData.personaName === "string" ? parsedData.personaName : null;
              setStreamingMeta({
                model: resolvedModel,
                gemName: resolvedGemName,
                personaName: resolvedPersonaName,
                feature: params.feature,
                subLabel: params.subLabel,
                bibleTarget: params.bibleTarget,
              });
            } else if (eventType === "thinking") {
              const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
              if (tChunk) {
                fullThinking += tChunk;
                setStreamingThinking(fullThinking);
              }
            } else if (eventType === "token") {
              const tChunk = typeof parsedData.t === "string" ? parsedData.t : "";
              if (tChunk) {
                fullContent += tChunk;
                setStreamingContent(fullContent);
              }
            } else if (eventType === "error") {
              const errMsg =
                typeof parsedData.message === "string"
                  ? parsedData.message
                  : "Stream error occurred";
              throw new Error(errMsg);
            }
          }
        }

        if (!controller.signal.aborted && fullContent.trim().length > 0) {
          const newCard: NovelcrafterHistoryCard = {
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            feature: params.feature,
            subLabel: params.subLabel,
            bibleTarget: params.bibleTarget,
            chapterId: activeChapterId,
            content: fullContent.trim(),
            thinking: fullThinking.trim() || undefined,
            model: resolvedModel,
            gemName: resolvedGemName,
            personaName: resolvedPersonaName,
            createdAt: Date.now(),
          };
          onCardCompleted(newCard);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to run AI tool";
        streamHookLogger.error("Novelcrafter stream failed:", msg);
        toast.error(msg);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [
      stopStream,
      selectedConversationId,
      ensureStoryConversation,
      selectedModel,
      routing,
      storyBible,
      activeChapterId,
      chapterTitle,
      chapterScenes,
      chapterProse,
      previousChapterProseTail,
      onCardCompleted,
    ]
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
