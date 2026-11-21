"use client";

import { useCallback } from "react";
import { logger } from "@/lib/utils/logger";
import {
  appendUserMessageWithTruncate,
  readStoredThinkingLevel,
  requestChatStream,
  resetStreamExecutionRefs,
  type CoreSendOptions,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";
import { resolveStreamErrorMessage } from "../StreamErrorBanner";
import { readStoredStrataSampling } from "./useStrataSampling";
import type { UseChatStreamExecutionParams } from "./chatStreamHookTypes";

export type { UseChatStreamExecutionParams };

export function useChatStreamExecution(params: UseChatStreamExecutionParams) {
  const {
    isAuthed,
    creatingConversation,
    selectedConversationId,
    input,
    setSelectedConversationId,
    createConversation,
    onStreamError,
    abortControllerRef,
    activeConvIdRef,
    prevConversationIdRef,
    isUnmountedRef,
    currentClientMessageIdRef,
    currentTruncateClientMessageIdRef,
    localSourcesRef,
    localRagSourcesRef,
    localUrlContextRef,
    hasStreamErrorRef,
    lastStreamErrorRef,
    accumulatedAssistantRef,
    accumulatedThinkingRef,
    emptyAnswerReasonRef,
    setInput,
    setCreatingConversation,
    setIsStreaming,
    setRegenerating,
    setMessages,
    setStreamingAssistant,
    setStreamingThinking,
    setStreamingLocalProgress,
    setStreamingSources,
    setStreamingRagSources,
    setStreamingUrlContext,
    setStreamError,
    stopTypewriter,
    resetTypewriterBuffer,
    resetThinkingStats,
    finalizeAssistantMessage,
    reloadMessagesAfterStream,
    processStreamResponse,
    t,
  } = params;

  const clearStreamBuffers = useCallback(
    (assistantValue: string | null) => {
      resetThinkingStats();
      setStreamingLocalProgress(null);
      setStreamingAssistant(assistantValue);
      setStreamingThinking("");
      setStreamingSources([]);
      setStreamingRagSources([]);
      setStreamingUrlContext([]);
    },
    [
      resetThinkingStats,
      setStreamingAssistant,
      setStreamingLocalProgress,
      setStreamingRagSources,
      setStreamingSources,
      setStreamingThinking,
      setStreamingUrlContext,
    ]
  );

  const cancelStream = useCallback(
    (commitPartial = false) => {
      const targetConvId = activeConvIdRef.current || selectedConversationId;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      if (commitPartial) {
        const syncPromise = finalizeAssistantMessage("aborted", targetConvId);
        if (targetConvId) {
          void syncPromise.then(() => {
            if (!isUnmountedRef.current && activeConvIdRef.current === targetConvId) {
              void reloadMessagesAfterStream(targetConvId);
            }
          });
        }
      } else {
        stopTypewriter(false);
        resetTypewriterBuffer();
        clearStreamBuffers(null);
        setIsStreaming(false);
        setRegenerating(false);
      }
    },
    [
      abortControllerRef,
      activeConvIdRef,
      clearStreamBuffers,
      finalizeAssistantMessage,
      isUnmountedRef,
      reloadMessagesAfterStream,
      resetTypewriterBuffer,
      selectedConversationId,
      setIsStreaming,
      setRegenerating,
      stopTypewriter,
    ]
  );

  const ensureConversationExists = useCallback(
    async (controller: AbortController): Promise<string | null> => {
      if (selectedConversationId) {
        activeConvIdRef.current = selectedConversationId;
        return selectedConversationId;
      }
      setCreatingConversation(true);
      try {
        const conv = await createConversation?.();
        if (
          isUnmountedRef.current ||
          controller.signal.aborted ||
          abortControllerRef.current !== controller
        ) {
          return null;
        }
        const convId = conv?.id || null;
        if (convId) {
          activeConvIdRef.current = convId;
          prevConversationIdRef.current = convId;
          setSelectedConversationId?.(convId);
        }
        return convId;
      } finally {
        if (!isUnmountedRef.current) setCreatingConversation(false);
      }
    },
    [
      abortControllerRef,
      activeConvIdRef,
      createConversation,
      isUnmountedRef,
      prevConversationIdRef,
      selectedConversationId,
      setCreatingConversation,
      setSelectedConversationId,
    ]
  );

  const coreSend = useCallback(
    async (text: string, options: CoreSendOptions = {}) => {
      if (!isAuthed || creatingConversation || !text) return;

      const { truncateFromIndex, fileIds } = options;
      const signal = resetStreamExecutionRefs(
        {
          abortControllerRef,
          currentClientMessageIdRef,
          currentTruncateClientMessageIdRef,
          localSourcesRef,
          localRagSourcesRef,
          localUrlContextRef,
          hasStreamErrorRef,
          lastStreamErrorRef,
          accumulatedAssistantRef,
          accumulatedThinkingRef,
          emptyAnswerReasonRef,
        },
        options.truncateClientMessageId
      );
      const controller = abortControllerRef.current;
      if (!controller) return;

      let convId: string | null = selectedConversationId;
      let didPrepareMessages = false;
      setIsStreaming(true);

      try {
        convId = await ensureConversationExists(controller);
        if (
          isUnmountedRef.current ||
          controller.signal.aborted ||
          abortControllerRef.current !== controller
        ) {
          return;
        }
        if (!convId && createConversation) {
          return;
        }

        didPrepareMessages = true;
        setInput("");
        clearStreamBuffers("");

        if (typeof truncateFromIndex === "number") {
          setMessages((prev) => prev.slice(0, truncateFromIndex));
        }
        if (!options.skipUserAppend) {
          setMessages((prev) =>
            appendUserMessageWithTruncate(prev, text, { truncateFromIndex, fileIds })
          );
        }

        const thinkingLevel = readStoredThinkingLevel();
        const streamResult = await requestChatStream({
          conversationId: convId,
          content: text,
          clientMessageId: currentClientMessageIdRef.current,
          truncateMessageId: options.truncateMessageId,
          truncateClientMessageId: options.truncateClientMessageId,
          regenerate: Boolean(options.regenerate),
          skipSaveUserMessage: options.skipSaveUserMessage,
          thinkingLevel,
          strataSampling: readStoredStrataSampling(thinkingLevel !== "off"),
          fileIds,
          signal,
        });
        if (
          isUnmountedRef.current ||
          controller.signal.aborted ||
          abortControllerRef.current !== controller
        ) {
          return;
        }

        if (!streamResult.ok) {
          hasStreamErrorRef.current = true;
          lastStreamErrorRef.current = streamResult.error;
          setStreamError(streamResult.error);
          onStreamError?.(streamResult.error);
          toast.error(resolveStreamErrorMessage(streamResult.error, t));
          void finalizeAssistantMessage("error", activeConvIdRef.current || convId);
          return;
        }

        await processStreamResponse(streamResult.reader, { current: [] }, { current: [] });
        stopTypewriter(true);

        await new Promise((resolve) => setTimeout(resolve, 30));
        if (
          isUnmountedRef.current ||
          controller.signal.aborted ||
          abortControllerRef.current !== controller
        ) {
          return;
        }

        const effectiveConvId = activeConvIdRef.current || convId;
        const finalStatus = hasStreamErrorRef.current ? "error" : "complete";
        await finalizeAssistantMessage(finalStatus, effectiveConvId);
        await reloadMessagesAfterStream(effectiveConvId);
      } catch (e: unknown) {
        const errName = e instanceof Error ? e.name : (e as { name?: string } | null)?.name;
        const isStillActive =
          !isUnmountedRef.current &&
          !controller.signal.aborted &&
          abortControllerRef.current === controller;
        if (errName !== "AbortError" && isStillActive) {
          logger.error("Stream error:", e);
          if (!hasStreamErrorRef.current) {
            const errData: StreamError = {
              message: t("streamNetworkError"),
              code: "NETWORK_ERROR",
            };
            hasStreamErrorRef.current = true;
            lastStreamErrorRef.current = errData;
            setStreamError(errData);
            onStreamError?.(errData);
            toast.error(resolveStreamErrorMessage(errData, t));
          }
          if (didPrepareMessages) {
            void finalizeAssistantMessage("error", activeConvIdRef.current || convId);
          }
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          if (!isUnmountedRef.current) setIsStreaming(false);
        }
      }
    },
    [
      abortControllerRef,
      accumulatedAssistantRef,
      accumulatedThinkingRef,
      activeConvIdRef,
      clearStreamBuffers,
      createConversation,
      creatingConversation,
      currentClientMessageIdRef,
      currentTruncateClientMessageIdRef,
      emptyAnswerReasonRef,
      ensureConversationExists,
      finalizeAssistantMessage,
      hasStreamErrorRef,
      isAuthed,
      isUnmountedRef,
      lastStreamErrorRef,
      localRagSourcesRef,
      localSourcesRef,
      localUrlContextRef,
      onStreamError,
      processStreamResponse,
      reloadMessagesAfterStream,
      selectedConversationId,
      setInput,
      setIsStreaming,
      setMessages,
      setStreamError,
      stopTypewriter,
      t,
    ]
  );

  const handleSend = useCallback(
    (text?: string, fileIds?: string[]) => {
      void coreSend(text ?? input, fileIds ? { fileIds } : {});
    },
    [coreSend, input]
  );

  const handleStop = useCallback(() => cancelStream(true), [cancelStream]);

  return { cancelStream, coreSend, handleSend, handleStop };
}
