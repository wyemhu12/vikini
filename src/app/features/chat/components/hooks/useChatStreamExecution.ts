"use client";

import { useCallback } from "react";
import { logger } from "@/lib/utils/logger";
import {
  appendUserMessageWithTruncate,
  clearStreamRuntimeState,
  isExecutionAborted,
  readStoredThinkingLevel,
  recordStreamExecutionError,
  requestChatStream,
  resetStreamExecutionRefs,
  type CoreSendOptions,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import {
  createInitialStreamActivity,
  type StreamActivity,
} from "@/lib/features/chat/streamActivity";
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
    setStreamingActivity,
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
    (assistantValue: string | null, activityValue: StreamActivity | null = null) => {
      clearStreamRuntimeState({
        assistantValue,
        activityValue,
        resetThinkingStats,
        setStreamingLocalProgress,
        setStreamingActivity,
        setStreamingAssistant,
        setStreamingThinking,
        setStreamingSources,
        setStreamingRagSources,
        setStreamingUrlContext,
      });
    },
    [
      resetThinkingStats,
      setStreamingActivity,
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
        clearStreamBuffers(null, null);
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
        if (isExecutionAborted(isUnmountedRef, abortControllerRef, controller)) {
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

      const reportError = (error: StreamError) => {
        recordStreamExecutionError({
          error,
          hasStreamErrorRef,
          lastStreamErrorRef,
          setStreamError,
          onStreamError,
          notifyError: (err) => toast.error(resolveStreamErrorMessage(err, t)),
        });
      };

      try {
        convId = await ensureConversationExists(controller);
        if (isExecutionAborted(isUnmountedRef, abortControllerRef, controller)) return;
        if (!convId && createConversation) return;

        didPrepareMessages = true;
        setInput("");
        clearStreamBuffers("", createInitialStreamActivity());

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
        if (isExecutionAborted(isUnmountedRef, abortControllerRef, controller)) return;

        if (!streamResult.ok) {
          reportError(streamResult.error);
          void finalizeAssistantMessage("error", activeConvIdRef.current || convId);
          return;
        }

        await processStreamResponse(streamResult.reader, { current: [] }, { current: [] });
        stopTypewriter(true);

        await new Promise((resolve) => setTimeout(resolve, 30));
        if (isExecutionAborted(isUnmountedRef, abortControllerRef, controller)) return;

        const effectiveConvId = activeConvIdRef.current || convId;
        const finalStatus = hasStreamErrorRef.current ? "error" : "complete";
        await finalizeAssistantMessage(finalStatus, effectiveConvId);
        await reloadMessagesAfterStream(effectiveConvId);
      } catch (e: unknown) {
        const errName = e instanceof Error ? e.name : (e as { name?: string } | null)?.name;
        if (
          errName !== "AbortError" &&
          !isExecutionAborted(isUnmountedRef, abortControllerRef, controller)
        ) {
          logger.error("Stream error:", e);
          if (!hasStreamErrorRef.current) {
            reportError({ message: t("streamNetworkError"), code: "NETWORK_ERROR" });
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
