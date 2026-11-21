"use client";

import { useCallback } from "react";
import {
  parseSSEEvent,
  safeArray,
  splitSSEFrames,
  type ParsedSSEEvent,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";
import { resolveStreamErrorMessage } from "../StreamErrorBanner";
import type { UseChatStreamReaderParams } from "./chatStreamHookTypes";

export type { UseChatStreamReaderParams };

export function useChatStreamReader(params: UseChatStreamReaderParams) {
  const {
    setSelectedConversationId,
    refreshConversations,
    renameConversationOptimistic,
    renameConversationFinal,
    onWebSearchMeta,
    onStreamError,
    activeConvIdRef,
    prevConversationIdRef,
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
        activeConvIdRef.current = data.conversation.id;
        prevConversationIdRef.current = data.conversation.id;
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
      activeConvIdRef,
      emptyAnswerReasonRef,
      localRagSourcesRef,
      localSourcesRef,
      localUrlContextRef,
      onWebSearchMeta,
      prevConversationIdRef,
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

      const processFrame = async (part: string) => {
        const parsed = parseSSEEvent(part);
        if (!parsed) return;

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
              data?.message || (typeof data?.error === "string" ? data.error : "") || t("error"),
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
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { frames, remainder } = splitSSEFrames(buffer);
        buffer = remainder;

        for (const frame of frames) {
          await processFrame(frame);
        }
      }

      // Flush final multi-byte UTF-8 sequence and trailing SSE frame without trailing blank line
      buffer += decoder.decode();
      if (buffer.trim()) {
        const { frames, remainder } = splitSSEFrames(buffer);
        for (const frame of frames) {
          await processFrame(frame);
        }
        if (remainder.trim()) {
          await processFrame(remainder);
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
