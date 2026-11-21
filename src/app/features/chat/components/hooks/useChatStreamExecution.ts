"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { logger } from "@/lib/utils/logger";
import type { LocalStreamProgress } from "@/lib/features/chat/thinkingStats";
import {
  appendUserMessageWithTruncate,
  buildChatStreamPayload,
  extractStreamHttpError,
  generateClientMessageId,
  readStoredThinkingLevel,
  type ChatFrontendMessage,
  type CoreSendOptions,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";
import { resolveStreamErrorMessage } from "../StreamErrorBanner";
import { readStoredStrataSampling } from "./useStrataSampling";

export interface UseChatStreamExecutionParams {
  isAuthed: boolean;
  creatingConversation: boolean;
  selectedConversationId: string | null;
  input: string;
  setSelectedConversationId?: (id: string | null) => void;
  createConversation?: () => Promise<{ id: string; [key: string]: unknown } | null>;
  onStreamError?: (error: StreamError) => void;
  abortControllerRef: MutableRefObject<AbortController | null>;
  isUnmountedRef: MutableRefObject<boolean>;
  currentClientMessageIdRef: MutableRefObject<string | null>;
  currentTruncateClientMessageIdRef: MutableRefObject<string | null>;
  localSourcesRef: MutableRefObject<unknown[]>;
  localRagSourcesRef: MutableRefObject<unknown[]>;
  localUrlContextRef: MutableRefObject<unknown[]>;
  hasStreamErrorRef: MutableRefObject<boolean>;
  lastStreamErrorRef: MutableRefObject<StreamError | null>;
  accumulatedAssistantRef: MutableRefObject<string>;
  accumulatedThinkingRef: MutableRefObject<string>;
  emptyAnswerReasonRef: MutableRefObject<"length" | "no_content" | null>;
  setInput: Dispatch<SetStateAction<string>>;
  setCreatingConversation: Dispatch<SetStateAction<boolean>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setRegenerating: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setStreamingAssistant: Dispatch<SetStateAction<string | null>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  setStreamError: Dispatch<SetStateAction<StreamError | null>>;
  stopTypewriter: (flush?: boolean) => void;
  resetTypewriterBuffer: () => void;
  resetThinkingStats: () => void;
  finalizeAssistantMessage: (
    status: "aborted" | "error" | "complete",
    convId: string | null
  ) => void;
  reloadMessagesAfterStream: (convId: string | null) => Promise<void>;
  processStreamResponse: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    localSources: { current: unknown[] },
    localUrlContext: { current: unknown[] }
  ) => Promise<void>;
  t: (key: string) => string;
}

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

  const cancelStream = useCallback(
    (commitPartial = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (commitPartial) {
        finalizeAssistantMessage("aborted", selectedConversationId);
      } else {
        stopTypewriter(false);
        resetTypewriterBuffer();
        resetThinkingStats();
        setStreamingLocalProgress(null);
        setIsStreaming(false);
        setRegenerating(false);
        setStreamingAssistant(null);
        setStreamingThinking("");
        setStreamingSources([]);
        setStreamingRagSources([]);
        setStreamingUrlContext([]);
      }

      if (commitPartial && selectedConversationId) {
        void reloadMessagesAfterStream(selectedConversationId);
      }
    },
    [
      abortControllerRef,
      finalizeAssistantMessage,
      reloadMessagesAfterStream,
      resetThinkingStats,
      resetTypewriterBuffer,
      selectedConversationId,
      setIsStreaming,
      setRegenerating,
      setStreamingAssistant,
      setStreamingLocalProgress,
      setStreamingRagSources,
      setStreamingSources,
      setStreamingThinking,
      setStreamingUrlContext,
      stopTypewriter,
    ]
  );

  const ensureConversationExists = useCallback(async (): Promise<string | null> => {
    if (selectedConversationId) return selectedConversationId;
    setCreatingConversation(true);
    try {
      const conv = await createConversation?.();
      const convId = conv?.id || null;
      if (convId) setSelectedConversationId?.(convId);
      return convId;
    } finally {
      setCreatingConversation(false);
    }
  }, [
    createConversation,
    selectedConversationId,
    setCreatingConversation,
    setSelectedConversationId,
  ]);

  const prepareStreamRequest = useCallback(
    (text: string, options: CoreSendOptions) => {
      const regenerate = Boolean(options?.regenerate);
      const skipUserAppend = Boolean(options?.skipUserAppend);
      const truncateFromIndex = options?.truncateFromIndex;
      const truncateMessageId = options?.truncateMessageId;
      const skipSaveUserMessage = options?.skipSaveUserMessage;
      const optFileIds = options?.fileIds;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      currentClientMessageIdRef.current = generateClientMessageId();
      currentTruncateClientMessageIdRef.current = options?.truncateClientMessageId || null;
      localSourcesRef.current = [];
      localRagSourcesRef.current = [];
      localUrlContextRef.current = [];
      hasStreamErrorRef.current = false;
      lastStreamErrorRef.current = null;
      accumulatedAssistantRef.current = "";
      accumulatedThinkingRef.current = "";
      emptyAnswerReasonRef.current = null;

      setInput("");
      setIsStreaming(true);
      setStreamingAssistant("");
      setStreamingThinking("");
      resetThinkingStats();
      setStreamingLocalProgress(null);
      setStreamingSources([]);
      setStreamingRagSources([]);
      setStreamingUrlContext([]);

      if (typeof truncateFromIndex === "number") {
        setMessages((prev) => prev.slice(0, truncateFromIndex));
      }

      if (!skipUserAppend) {
        setMessages((prev) =>
          appendUserMessageWithTruncate(prev, text, { truncateFromIndex, fileIds: optFileIds })
        );
      }

      return {
        signal,
        regenerate,
        truncateMessageId,
        truncateClientMessageId: options?.truncateClientMessageId,
        skipSaveUserMessage,
      };
    },
    [
      abortControllerRef,
      accumulatedAssistantRef,
      accumulatedThinkingRef,
      currentClientMessageIdRef,
      currentTruncateClientMessageIdRef,
      emptyAnswerReasonRef,
      hasStreamErrorRef,
      lastStreamErrorRef,
      localRagSourcesRef,
      localSourcesRef,
      localUrlContextRef,
      resetThinkingStats,
      setInput,
      setIsStreaming,
      setMessages,
      setStreamingAssistant,
      setStreamingLocalProgress,
      setStreamingRagSources,
      setStreamingSources,
      setStreamingThinking,
      setStreamingUrlContext,
    ]
  );

  const coreSend = useCallback(
    async (text: string, options: CoreSendOptions = {}) => {
      if (!isAuthed || creatingConversation || !text) return;

      const { signal, regenerate, truncateMessageId, skipSaveUserMessage } = prepareStreamRequest(
        text,
        options
      );
      const convId = await ensureConversationExists();
      if (isUnmountedRef.current) return;

      try {
        const thinkingLevel = readStoredThinkingLevel();
        const strataSampling = readStoredStrataSampling(thinkingLevel !== "off");
        const payload = buildChatStreamPayload({
          conversationId: convId,
          content: text,
          clientMessageId: currentClientMessageIdRef.current,
          truncateMessageId,
          truncateClientMessageId: options?.truncateClientMessageId,
          regenerate,
          skipSaveUserMessage,
          thinkingLevel,
          strataSampling,
          fileIds: options.fileIds,
        });

        const res = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok || !res.body) {
          if (isUnmountedRef.current) return;
          const errData = await extractStreamHttpError(res);
          hasStreamErrorRef.current = true;
          lastStreamErrorRef.current = errData;
          setStreamError(errData);
          onStreamError?.(errData);
          toast.error(resolveStreamErrorMessage(errData, t));
          finalizeAssistantMessage("error", convId);
          return;
        }

        const reader = res.body.getReader();
        const localSources = { current: [] as unknown[] };
        const localUrlContext = { current: [] as unknown[] };

        await processStreamResponse(reader, localSources, localUrlContext);
        stopTypewriter(true);

        await new Promise((resolve) => setTimeout(resolve, 30));
        if (isUnmountedRef.current) return;

        const finalStatus = hasStreamErrorRef.current ? "error" : "complete";
        finalizeAssistantMessage(finalStatus, convId);
        await reloadMessagesAfterStream(convId);
      } catch (e: unknown) {
        const error = e as Error & { name?: string };
        if (error?.name !== "AbortError" && !isUnmountedRef.current) {
          logger.error("Stream error:", e);
          finalizeAssistantMessage("error", convId);
        }
      } finally {
        if (!isUnmountedRef.current) setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      abortControllerRef,
      creatingConversation,
      currentClientMessageIdRef,
      ensureConversationExists,
      finalizeAssistantMessage,
      hasStreamErrorRef,
      isAuthed,
      isUnmountedRef,
      lastStreamErrorRef,
      onStreamError,
      prepareStreamRequest,
      processStreamResponse,
      reloadMessagesAfterStream,
      setIsStreaming,
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

  const handleStop = useCallback(() => {
    cancelStream(true);
  }, [cancelStream]);

  return { cancelStream, coreSend, handleSend, handleStop };
}
