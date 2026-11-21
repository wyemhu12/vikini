"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { LocalStreamProgress } from "@/lib/features/chat/thinkingStats";
import {
  parseSSEEvent,
  safeArray,
  type ParsedSSEEvent,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";
import { resolveStreamErrorMessage } from "../StreamErrorBanner";

export interface UseChatStreamReaderParams {
  setSelectedConversationId?: (id: string | null) => void;
  refreshConversations?: () => Promise<void>;
  renameConversationOptimistic?: (id: string, title: string) => void;
  renameConversationFinal?: (id: string, title: string) => void;
  onWebSearchMeta?: (meta: { enabled?: boolean; available?: boolean; raw?: unknown }) => void;
  onStreamError?: (error: StreamError) => void;
  localSourcesRef: MutableRefObject<unknown[]>;
  localRagSourcesRef: MutableRefObject<unknown[]>;
  localUrlContextRef: MutableRefObject<unknown[]>;
  hasStreamErrorRef: MutableRefObject<boolean>;
  lastStreamErrorRef: MutableRefObject<StreamError | null>;
  accumulatedThinkingRef: MutableRefObject<string>;
  emptyAnswerReasonRef: MutableRefObject<"length" | "no_content" | null>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamError: Dispatch<SetStateAction<StreamError | null>>;
  startTypewriter: () => void;
  appendToTypewriterBuffer: (token: string) => void;
  markThinking: (chunk: string) => void;
  markAnswer: () => void;
  t: (key: string) => string;
}

export function useChatStreamReader(params: UseChatStreamReaderParams) {
  const {
    setSelectedConversationId,
    refreshConversations,
    renameConversationOptimistic,
    renameConversationFinal,
    onWebSearchMeta,
    onStreamError,
    localSourcesRef,
    localRagSourcesRef,
    localUrlContextRef,
    hasStreamErrorRef,
    lastStreamErrorRef,
    accumulatedThinkingRef,
    emptyAnswerReasonRef,
    setStreamingSources,
    setStreamingRagSources,
    setStreamingUrlContext,
    setStreamingThinking,
    setStreamingLocalProgress,
    setStreamError,
    startTypewriter,
    appendToTypewriterBuffer,
    markThinking,
    markAnswer,
    t,
  } = params;

  const handleStreamMetaEvent = useCallback(
    async (
      data: ParsedSSEEvent["data"],
      localSources: { current: unknown[] },
      localUrlContext: { current: unknown[] }
    ) => {
      if (data?.type === "conversationCreated" && data?.conversation?.id) {
        setSelectedConversationId?.(data.conversation.id);
        await refreshConversations?.();
      }
      if (data?.type === "optimisticTitle" && data?.title) {
        renameConversationOptimistic?.(data.conversationId || "", data.title || "New Chat");
      }
      if (data?.type === "finalTitle" && data?.title) {
        renameConversationFinal?.(data.conversationId || "", data.title || "New Chat");
      }
      if (data?.type === "sources") {
        const sources = safeArray(data?.sources);
        setStreamingSources(sources);
        localSources.current = sources;
        localSourcesRef.current = sources;
      }
      if (data?.type === "ragSources" && Array.isArray(data?.sources)) {
        const sources = safeArray(data?.sources);
        setStreamingRagSources(sources);
        localRagSourcesRef.current = sources;
      }
      if (data?.type === "urlContext") {
        const urls = safeArray(data?.urls);
        setStreamingUrlContext(urls);
        localUrlContext.current = urls;
        localUrlContextRef.current = urls;
      }
      if (data?.type === "webSearch") {
        const enabled = typeof data?.enabled === "boolean" ? data.enabled : undefined;
        const available = typeof data?.available === "boolean" ? data.available : undefined;
        if (typeof onWebSearchMeta === "function") {
          onWebSearchMeta({ enabled, available, raw: data });
        }
      }
      if (
        data?.type === "emptyAnswerNotice" &&
        (data.reason === "length" || data.reason === "no_content")
      ) {
        emptyAnswerReasonRef.current = data.reason;
      }
      if (data?.type === "localQueue" && typeof data.position === "number") {
        setStreamingLocalProgress({ type: "localQueue", position: data.position });
      }
      if (
        data?.type === "localPromptProgress" &&
        typeof data.total === "number" &&
        typeof data.processed === "number"
      ) {
        setStreamingLocalProgress({
          type: "localPromptProgress",
          total: data.total,
          cache: typeof data.cache === "number" ? data.cache : 0,
          processed: data.processed,
          time_ms: typeof data.time_ms === "number" ? data.time_ms : 0,
        });
      }
    },
    [
      emptyAnswerReasonRef,
      localRagSourcesRef,
      localSourcesRef,
      localUrlContextRef,
      onWebSearchMeta,
      refreshConversations,
      renameConversationFinal,
      renameConversationOptimistic,
      setSelectedConversationId,
      setStreamingLocalProgress,
      setStreamingRagSources,
      setStreamingSources,
      setStreamingUrlContext,
    ]
  );

  const processStreamResponse = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      localSources: { current: unknown[] },
      localUrlContext: { current: unknown[] }
    ): Promise<void> => {
      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstToken = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const parsed = parseSSEEvent(part);
          if (!parsed) continue;

          const { event, data } = parsed;

          if (event === "token") {
            const tok = data?.t || "";
            if (tok) {
              if (isFirstToken) {
                isFirstToken = false;
                markAnswer();
                setStreamingLocalProgress(null);
                startTypewriter();
              }
              appendToTypewriterBuffer(tok);
            }
          }

          if (event === "thinking") {
            const thinkingChunk = typeof data?.thinking === "string" ? data.thinking : "";
            if (thinkingChunk) {
              accumulatedThinkingRef.current += thinkingChunk;
              setStreamingThinking((prev) => (prev || "") + thinkingChunk);
              markThinking(thinkingChunk);
              setStreamingLocalProgress(null);
            }
          }

          if (event === "meta") {
            await handleStreamMetaEvent(data, localSources, localUrlContext);
          }

          if (event === "error") {
            const errorData: StreamError = {
              message:
                data?.message ||
                (typeof data?.error === "string" ? data.error : "") ||
                "An error occurred",
              code: data?.code,
              status: data?.status,
              isTokenLimit: data?.isTokenLimit,
              tokenInfo: data?.tokenInfo,
            };
            hasStreamErrorRef.current = true;
            lastStreamErrorRef.current = errorData;
            setStreamError(errorData);
            onStreamError?.(errorData);
            toast.error(resolveStreamErrorMessage(errorData, t));
          }
        }
      }
    },
    [
      accumulatedThinkingRef,
      appendToTypewriterBuffer,
      handleStreamMetaEvent,
      hasStreamErrorRef,
      lastStreamErrorRef,
      markAnswer,
      markThinking,
      onStreamError,
      setStreamError,
      setStreamingLocalProgress,
      setStreamingThinking,
      startTypewriter,
      t,
    ]
  );

  return { handleStreamMetaEvent, processStreamResponse };
}
