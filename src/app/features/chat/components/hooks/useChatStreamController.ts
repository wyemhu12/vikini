// /app/components/Chat/hooks/useChatStreamController.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalStreamProgress } from "@/lib/features/chat/thinkingStats";
import type { StreamActivity } from "@/lib/features/chat/streamActivity";
import {
  normalizeFrontendMessages,
  type ChatFrontendMessage,
  type StreamError,
} from "@/lib/features/chat/streamProtocol";
import { useLanguage } from "../../hooks/useLanguage";
import { useThinkingStats } from "./useThinkingStats";
import { useTypewriterBuffer } from "./useTypewriterBuffer";
import { useChatPartialPersistence } from "./useChatPartialPersistence";
import { useChatStreamReader } from "./useChatStreamReader";
import { useChatStreamExecution } from "./useChatStreamExecution";
import { useChatMessageActions } from "./useChatMessageActions";

export type { StreamError };

interface UseChatStreamControllerParams {
  isAuthed: boolean;
  selectedConversationId: string | null;
  setSelectedConversationId?: (id: string | null) => void;
  createConversation?: () => Promise<{ id: string; [key: string]: unknown } | null>;
  refreshConversations?: () => Promise<void>;
  renameConversationOptimistic?: (id: string, title: string) => void;
  renameConversationFinal?: (id: string, title: string) => void;
  onWebSearchMeta?: (meta: { enabled?: boolean; available?: boolean; raw?: unknown }) => void;
  onStreamError?: (error: StreamError) => void;
}

export function useChatStreamController({
  isAuthed,
  selectedConversationId,
  setSelectedConversationId,
  createConversation,
  refreshConversations,
  renameConversationOptimistic,
  renameConversationFinal,
  onWebSearchMeta,
  onStreamError,
}: UseChatStreamControllerParams) {
  const { t } = useLanguage();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const {
    stats: streamingThinkingStats,
    markThinking,
    markAnswer,
    reset: resetThinkingStats,
  } = useThinkingStats();
  const thinkingStatsSnapshotRef = useRef(streamingThinkingStats);
  useEffect(() => {
    thinkingStatsSnapshotRef.current = streamingThinkingStats;
  }, [streamingThinkingStats]);

  const [messages, setMessages] = useState<ChatFrontendMessage[]>([]);
  const [contextMessagesCount, setContextMessagesCount] = useState(0);
  const [input, setInput] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [streamingThinking, setStreamingThinking] = useState<string>("");
  const [streamingLocalProgress, setStreamingLocalProgress] = useState<LocalStreamProgress | null>(
    null
  );
  const [streamingActivity, setStreamingActivity] = useState<StreamActivity | null>(null);
  const [streamingSources, setStreamingSources] = useState<unknown[]>([]);
  const [streamingRagSources, setStreamingRagSources] = useState<unknown[]>([]);
  const [streamingUrlContext, setStreamingUrlContext] = useState<unknown[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [streamError, setStreamError] = useState<StreamError | null>(null);

  // Concurrency, persistence & teardown refs
  const messagesRef = useRef<ChatFrontendMessage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const activeConvIdRef = useRef<string | null>(selectedConversationId);
  const isUnmountedRef = useRef<boolean>(false);
  const streamingAssistantRef = useRef<string | null>(streamingAssistant);
  const currentClientMessageIdRef = useRef<string | null>(null);
  const currentTruncateClientMessageIdRef = useRef<string | null>(null);
  const localSourcesRef = useRef<unknown[]>([]);
  const localRagSourcesRef = useRef<unknown[]>([]);
  const localUrlContextRef = useRef<unknown[]>([]);
  const hasStreamErrorRef = useRef<boolean>(false);
  const lastStreamErrorRef = useRef<StreamError | null>(null);
  const accumulatedAssistantRef = useRef<string>("");
  const accumulatedThinkingRef = useRef<string>("");
  const emptyAnswerReasonRef = useRef<"length" | "no_content" | null>(null);
  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConvIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const onTypewriterChunk = useCallback((chunk: string) => {
    setStreamingAssistant((prev) => (prev || "") + chunk);
  }, []);

  const {
    startTypewriter,
    stopTypewriter,
    appendToTypewriterBuffer: rawAppendToTypewriter,
    resetBuffer: resetTypewriterBuffer,
  } = useTypewriterBuffer(onTypewriterChunk);

  const appendToTypewriterBuffer = useCallback(
    (token: string) => {
      accumulatedAssistantRef.current += token;
      rawAppendToTypewriter(token);
    },
    [rawAppendToTypewriter]
  );

  const renderedMessages = useMemo(() => normalizeFrontendMessages(messages), [messages]);

  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Abort active SSE fetch and stop typewriter safely on unmount (Strict-Mode resilient)
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      stopTypewriter(false);
      resetTypewriterBuffer();
    };
  }, [stopTypewriter, resetTypewriterBuffer]);

  const persistence = useChatPartialPersistence({
    selectedConversationId,
    activeConvIdRef,
    isUnmountedRef,
    messagesRef,
    streamingAssistantRef,
    accumulatedAssistantRef,
    accumulatedThinkingRef,
    currentClientMessageIdRef,
    localSourcesRef,
    localRagSourcesRef,
    localUrlContextRef,
    emptyAnswerReasonRef,
    thinkingStatsSnapshotRef,
    setMessages,
    setContextMessagesCount,
    setIsStreaming,
    setStreamingAssistant,
    setStreamingThinking,
    setStreamingLocalProgress,
    setStreamingActivity,
    setStreamingSources,
    setStreamingRagSources,
    setStreamingUrlContext,
    stopTypewriter,
    markAnswer,
  });

  const reader = useChatStreamReader({
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
    setStreamingActivity,
    setStreamError,
    startTypewriter,
    appendToTypewriterBuffer,
    markThinking,
    markAnswer,
    t,
  });

  const execution = useChatStreamExecution({
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
    finalizeAssistantMessage: persistence.finalizeAssistantMessage,
    reloadMessagesAfterStream: persistence.reloadMessagesAfterStream,
    processStreamResponse: reader.processStreamResponse,
    t,
  });

  const actions = useChatMessageActions({
    selectedConversationId,
    loadingMessages,
    isStreaming,
    messagesLength: messages.length,
    messagesRef,
    activeConvIdRef,
    prevConversationIdRef,
    loadAbortRef,
    isUnmountedRef,
    tRef,
    setSelectedConversationId,
    createConversation,
    setMessages,
    setContextMessagesCount,
    setInput,
    setLoadingMessages,
    setRegenerating,
    cancelStream: execution.cancelStream,
    coreSend: execution.coreSend,
    waitForPartialMessageSaved: persistence.waitForPartialMessageSaved,
  });

  const clearStreamError = useCallback(() => setStreamError(null), []);

  return {
    messages,
    renderedMessages,
    contextMessagesCount,
    input,
    setInput,
    creatingConversation,
    loadingMessages,
    isStreaming,
    streamingAssistant,
    streamingThinking,
    streamingThinkingStats,
    streamingLocalProgress,
    streamingActivity,
    streamingSources,
    streamingRagSources,
    streamingUrlContext,
    regenerating,
    streamError,
    clearStreamError,
    resetChatUI: actions.resetChatUI,
    handleNewChat: actions.handleNewChat,
    handleSelectConversation: actions.handleSelectConversation,
    handleSend: execution.handleSend,
    handleRegenerate: actions.handleRegenerate,
    handleEdit: actions.handleEdit,
    handleStop: execution.handleStop,
    handleContinue: actions.handleContinue,
    retrySave: persistence.retrySave,
    setMessages,
  };
}
