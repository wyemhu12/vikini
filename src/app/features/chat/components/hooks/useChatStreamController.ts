// /app/components/Chat/hooks/useChatStreamController.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";
import { mergeMessages } from "@/lib/features/chat/messageMerge";
import { toast } from "@/lib/store/toastStore";
import { useTypewriterBuffer } from "./useTypewriterBuffer";

interface FrontendMessage {
  id?: string;
  role: string;
  content: string;
  sources?: unknown[];
  urlContext?: unknown[];
  [key: string]: unknown;
}

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

export interface StreamError {
  message: string;
  code?: string;
  status?: number;
  isTokenLimit?: boolean;
  tokenInfo?: { limit?: number; requested?: number } | null;
}

interface CoreSendOptions {
  regenerate?: boolean;
  skipUserAppend?: boolean;
  truncateFromIndex?: number;
  truncateMessageId?: string;
  truncateClientMessageId?: string;
  skipSaveUserMessage?: boolean;
  fileIds?: string[];
}

function safeArray<T>(v: T[] | unknown): T[] {
  return Array.isArray(v) ? v : [];
}

function generateClientMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "cm-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
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
  const [messages, setMessages] = useState<FrontendMessage[]>([]);
  const messagesRef = useRef<FrontendMessage[]>([]);
  const [input, setInput] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<unknown[]>([]);
  const [streamingUrlContext, setStreamingUrlContext] = useState<unknown[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [streamError, setStreamError] = useState<StreamError | null>(null);

  // AbortController để quản lý việc hủy request streaming
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingAssistantRef = useRef<string | null>(streamingAssistant);

  // Refs for client-side message persistence and deduplication
  const currentClientMessageIdRef = useRef<string | null>(null);
  const currentTruncateClientMessageIdRef = useRef<string | null>(null);
  const localSourcesRef = useRef<unknown[]>([]);
  const localUrlContextRef = useRef<unknown[]>([]);
  const hasStreamErrorRef = useRef<boolean>(false);
  const lastStreamErrorRef = useRef<StreamError | null>(null);
  const accumulatedAssistantRef = useRef<string>("");
  const emptyAnswerReasonRef = useRef<"length" | "no_content" | null>(null);

  const onTypewriterChunk = useCallback((chunk: string) => {
    setStreamingAssistant((prev) => (prev || "") + chunk);
  }, []);

  const {
    bufferRef: typewriterBufferRef,
    startTypewriter,
    stopTypewriter,
    appendToTypewriterBuffer: rawAppendToTypewriter,
  } = useTypewriterBuffer(onTypewriterChunk);

  const appendToTypewriterBuffer = useCallback(
    (token: string) => {
      accumulatedAssistantRef.current += token;
      rawAppendToTypewriter(token);
    },
    [rawAppendToTypewriter]
  );

  const normalizeMessages = useCallback((arr: FrontendMessage[] | unknown): FrontendMessage[] => {
    const safe = safeArray<FrontendMessage>(arr);
    return safe
      .map((m): FrontendMessage => {
        // Sources/urlContext can be top-level (from streaming) or inside meta (from DB reload)
        const meta = m?.meta as Record<string, unknown> | undefined;
        const sources =
          safeArray(m?.sources).length > 0 ? safeArray(m?.sources) : safeArray(meta?.sources);
        const urlContext =
          safeArray(m?.urlContext).length > 0
            ? safeArray(m?.urlContext)
            : safeArray(meta?.urlContext);

        return {
          id: m?.id,
          role: m?.role || "",
          content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
          sources,
          urlContext,
          meta: m?.meta,
        };
      })
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          !(m.meta as Record<string, unknown> | undefined)?.isContextOnly
      );
  }, []);

  const renderedMessages = useMemo(
    () => normalizeMessages(messages),
    [messages, normalizeMessages]
  );

  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  // Keep messagesRef always in sync with latest messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const syncPartialMessage = useCallback(
    async (convId: string, clientMsgId: string, content: string, meta: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            role: "assistant",
            content,
            clientMessageId: clientMsgId,
            meta,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data;
          const savedMsg = data?.message;
          const alreadyComplete = Boolean(data?.alreadyComplete);
          setMessages((prev) =>
            prev.map((m) => {
              const metaObj = m.meta as Record<string, unknown> | undefined;
              if (metaObj?.clientMessageId === clientMsgId || m.id === `temp-${clientMsgId}`) {
                if (alreadyComplete && savedMsg) {
                  return {
                    ...m,
                    id: savedMsg.id,
                    content: savedMsg.content,
                    meta: {
                      ...metaObj,
                      ...savedMsg.meta,
                      isPartial: false,
                      aborted: false,
                      isSaving: false,
                      saveFailed: false,
                    },
                  };
                }
                return {
                  ...m,
                  id: savedMsg?.id || m.id,
                  meta: {
                    ...metaObj,
                    isSaving: false,
                    saveFailed: false,
                  },
                };
              }
              return m;
            })
          );
        } else {
          throw new Error("Sync failed");
        }
      } catch (syncErr) {
        logger.error("Failed to sync partial message:", syncErr);
        setMessages((prev) =>
          prev.map((m) => {
            const metaObj = m.meta as Record<string, unknown> | undefined;
            if (metaObj?.clientMessageId === clientMsgId || m.id === `temp-${clientMsgId}`) {
              return {
                ...m,
                meta: {
                  ...metaObj,
                  isSaving: false,
                  saveFailed: true,
                },
              };
            }
            return m;
          })
        );
      }
    },
    []
  );

  const finalizeAssistantMessage = useCallback(
    (status: "aborted" | "error" | "complete", convId: string | null) => {
      stopTypewriter(true);

      const rawContent = accumulatedAssistantRef.current || streamingAssistantRef.current || "";
      const trimmed = rawContent.trim();
      if (!trimmed) {
        setIsStreaming(false);
        setStreamingAssistant(null);
        return;
      }

      const balanced = balanceThinkTags(rawContent);
      const clientMsgId = currentClientMessageIdRef.current;
      const isPartial = status !== "complete";

      const meta: Record<string, unknown> = {
        ...(clientMsgId ? { clientMessageId: clientMsgId } : {}),
        ...(isPartial ? { isPartial: true, aborted: true, status, isSaving: true } : { status }),
        sources: safeArray(localSourcesRef.current),
        urlContext: safeArray(localUrlContextRef.current),
        ...(emptyAnswerReasonRef.current
          ? { emptyAnswerReason: emptyAnswerReasonRef.current }
          : {}),
      };

      const assistantMsg: FrontendMessage = {
        role: "assistant",
        content: balanced,
        ...(isPartial && clientMsgId ? { id: `temp-${clientMsgId}` } : {}),
        sources: safeArray(localSourcesRef.current),
        urlContext: safeArray(localUrlContextRef.current),
        meta,
      };

      setMessages((prev) => [...normalizeMessages(prev), assistantMsg]);
      setIsStreaming(false);
      setStreamingAssistant(null);
      setStreamingSources([]);
      setStreamingUrlContext([]);

      if (isPartial && convId && clientMsgId) {
        void syncPartialMessage(convId, clientMsgId, balanced, meta);
      }
    },
    [stopTypewriter, normalizeMessages, syncPartialMessage]
  );

  const reloadMessagesAfterStream = useCallback(
    async (convId: string | null) => {
      if (!convId) return;

      try {
        const res = await fetch(`/api/conversations?id=${convId}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          if (data?.messages && Array.isArray(data.messages)) {
            setMessages((currentLocal) =>
              mergeMessages(normalizeMessages(data.messages), currentLocal)
            );
          }
        }
      } catch (reloadError) {
        // Non-critical: if reload fails, continue with local state
        logger.warn("Failed to reload messages after stream:", reloadError);
      }
    },
    [normalizeMessages]
  );

  // Hủy request và tùy chọn lưu lại nội dung đang stream dở
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
        typewriterBufferRef.current = "";
        setIsStreaming(false);
        setRegenerating(false);
        setStreamingAssistant(null);
        setStreamingSources([]);
        setStreamingUrlContext([]);
      }

      // Reload messages from server to ensure all messages have proper IDs
      if (commitPartial && selectedConversationId) {
        void reloadMessagesAfterStream(selectedConversationId);
      }
    },
    [finalizeAssistantMessage, selectedConversationId, stopTypewriter, reloadMessagesAfterStream]
  );

  const resetChatUI = useCallback(() => {
    cancelStream(false); // Reset thì không lưu
    setMessages([]);
    setInput("");
  }, [cancelStream]);

  const handleNewChat = useCallback(async () => {
    const conv = await createConversation?.();
    if (conv?.id) {
      setSelectedConversationId?.(conv.id);
      resetChatUI();
    }
  }, [createConversation, resetChatUI, setSelectedConversationId]);

  const handleSelectConversation = useCallback(
    async (id: string | null) => {
      cancelStream(false); // Chuyển chat thì bỏ qua nội dung đang stream cũ
      setSelectedConversationId?.(id);
      setInput("");

      if (!id) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const json = await res.json();
        const data = json.data || json;
        setMessages(normalizeMessages(data?.messages));
      } catch (e) {
        logger.error("Failed to load messages:", e);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [normalizeMessages, setSelectedConversationId, cancelStream]
  );

  // Auto-load messages when selectedConversationId changes (e.g., from URL sync on page reload)
  // This handles the case where URL has conversation ID but messages aren't loaded yet
  const prevConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip if no conversation selected or already loading
    if (!selectedConversationId || loadingMessages || isStreaming) return;

    // Skip if same conversation (already loaded)
    if (prevConversationIdRef.current === selectedConversationId) return;

    // Skip if messages already loaded for this conversation
    if (messages.length > 0 && prevConversationIdRef.current === selectedConversationId) return;

    // Load messages for this conversation
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${selectedConversationId}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const json = await res.json();
        const data = json.data || json;
        setMessages(normalizeMessages(data?.messages));
      } catch (e) {
        logger.error("Auto-load messages failed:", e);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    void loadMessages();
    prevConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId, loadingMessages, isStreaming, messages.length, normalizeMessages]);

  // --- EXTRACTED FUNCTIONS ---

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
  }, [selectedConversationId, createConversation, setSelectedConversationId]);

  const prepareStreamRequest = useCallback(
    (text: string, options: CoreSendOptions) => {
      const regenerate = Boolean(options?.regenerate);
      const skipUserAppend = Boolean(options?.skipUserAppend);
      const truncateFromIndex = options?.truncateFromIndex;
      const truncateMessageId = options?.truncateMessageId;
      const skipSaveUserMessage = options?.skipSaveUserMessage;
      const optFileIds = options?.fileIds;

      // Hủy request cũ nếu đang chạy
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      currentClientMessageIdRef.current = generateClientMessageId();
      currentTruncateClientMessageIdRef.current = options?.truncateClientMessageId || null;
      localSourcesRef.current = [];
      localUrlContextRef.current = [];
      hasStreamErrorRef.current = false;
      lastStreamErrorRef.current = null;
      accumulatedAssistantRef.current = "";
      emptyAnswerReasonRef.current = null;

      setInput("");
      setIsStreaming(true);
      setStreamingAssistant("");
      setStreamingSources([]);
      setStreamingUrlContext([]);

      if (typeof truncateFromIndex === "number") {
        setMessages((prev) => prev.slice(0, truncateFromIndex));
      }

      if (!skipUserAppend) {
        const userMsg: FrontendMessage = {
          role: "user",
          content: text,
          meta: optFileIds && optFileIds.length > 0 ? { fileIds: optFileIds } : undefined,
        };
        setMessages((prev) => {
          let current = normalizeMessages(prev);
          if (typeof truncateFromIndex === "number") {
            current = current.slice(0, truncateFromIndex);
          }
          return [...current, userMsg];
        });
      }

      return {
        signal,
        regenerate,
        truncateMessageId,
        truncateClientMessageId: options?.truncateClientMessageId,
        skipSaveUserMessage,
      };
    },
    [normalizeMessages]
  );

  interface ParsedSSEEvent {
    event: string;
    data: {
      type?: string;
      conversation?: { id?: string; [key: string]: unknown };
      conversationId?: string;
      title?: string;
      sources?: unknown[];
      urls?: unknown[];
      enabled?: boolean;
      available?: boolean;
      t?: string;
      error?: string;
      message?: string;
      code?: string;
      status?: number;
      isTokenLimit?: boolean;
      tokenInfo?: { limit?: number; requested?: number } | null;
      [key: string]: unknown;
    };
  }

  const parseSSEEvent = (part: string): ParsedSSEEvent | null => {
    const lines = part.split("\n").filter(Boolean);
    const eventLine = lines.find((l) => l.startsWith("event:"));
    const dataLine = lines.find((l) => l.startsWith("data:"));
    const event = eventLine?.replace("event:", "").trim();
    const dataStr = dataLine?.replace("data:", "").trim();

    if (!event || !dataStr) return null;

    try {
      const data = JSON.parse(dataStr);
      return { event, data };
    } catch {
      return null;
    }
  };

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
    },
    [
      setSelectedConversationId,
      refreshConversations,
      renameConversationOptimistic,
      renameConversationFinal,
      onWebSearchMeta,
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
              // Start typewriter on first token
              if (isFirstToken) {
                isFirstToken = false;
                startTypewriter();
              }
              // Add to buffer instead of direct state update
              appendToTypewriterBuffer(tok);
            }
          }

          if (event === "meta") {
            await handleStreamMetaEvent(data, localSources, localUrlContext);
          }

          // Handle error events from backend
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
          }
        }
      }
    },
    [handleStreamMetaEvent, onStreamError, startTypewriter, appendToTypewriterBuffer]
  );

  const coreSend = useCallback(
    async (text: string, options: CoreSendOptions = {}) => {
      if (!isAuthed) return;
      if (creatingConversation) return;
      if (!text) return;

      const { signal, regenerate, truncateMessageId, skipSaveUserMessage } = prepareStreamRequest(
        text,
        options
      );

      const convId = await ensureConversationExists();
      const fileIds = options.fileIds;

      try {
        // Read thinkingLevel from localStorage (set by useThinkingLevel hook)
        let thinkingLevel: string | undefined;
        try {
          const stored = localStorage.getItem("vikini.thinkingLevel");
          if (stored && ["off", "high", "low", "medium", "minimal"].includes(stored)) {
            thinkingLevel = stored;
          }
        } catch {
          // Ignore localStorage errors
        }

        const res = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            conversationId: convId,
            content: text,
            clientMessageId: currentClientMessageIdRef.current,
            truncateMessageId,
            truncateClientMessageId: options?.truncateClientMessageId,
            regenerate,
            skipSaveUserMessage,
            ...(thinkingLevel ? { thinkingLevel } : {}),
            ...(fileIds && fileIds.length > 0 ? { fileIds } : {}),
          }),
          signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const localSources = { current: [] as unknown[] };
        const localUrlContext = { current: [] as unknown[] };

        await processStreamResponse(reader, localSources, localUrlContext);

        // Ngay khi network stream kết thúc, lập tức flush toàn bộ buffer còn lại ra màn hình
        stopTypewriter(true);

        // Small delay to ensure final state update
        await new Promise((resolve) => setTimeout(resolve, 30));

        const finalStatus = hasStreamErrorRef.current ? "error" : "complete";
        finalizeAssistantMessage(finalStatus, convId);

        await reloadMessagesAfterStream(convId);
      } catch (e) {
        const error = e as Error & { name?: string };
        if (error.name !== "AbortError") {
          logger.error("Stream error:", e);
          finalizeAssistantMessage("error", convId);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      isAuthed,
      creatingConversation,
      prepareStreamRequest,
      ensureConversationExists,
      processStreamResponse,
      finalizeAssistantMessage,
      reloadMessagesAfterStream,
      stopTypewriter,
    ]
  );

  const handleSend = useCallback(
    (text?: string, fileIds?: string[]) => {
      void coreSend(text ?? input, fileIds ? { fileIds } : {});
    },
    [coreSend, input]
  );

  const handleRegenerate = useCallback(
    async (specificMessage?: FrontendMessage) => {
      if (isStreaming) return;
      setRegenerating(true);

      try {
        // Use messagesRef to always get the latest messages (avoid stale closure)
        const currentMsgs = normalizeMessages(messagesRef.current);
        let targetIndex = -1;

        if (specificMessage) {
          targetIndex = currentMsgs.findIndex((m) => {
            if (m === specificMessage) return true;
            if (m.id && specificMessage.id && m.id === specificMessage.id) return true;
            if (
              !m.id &&
              !specificMessage.id &&
              m.role === specificMessage.role &&
              m.content === specificMessage.content
            ) {
              return true;
            }
            return false;
          });

          if (targetIndex === -1 && !specificMessage.id) {
            for (let i = currentMsgs.length - 1; i >= 0; i--) {
              if (
                currentMsgs[i].role === specificMessage.role &&
                currentMsgs[i].content === specificMessage.content
              ) {
                targetIndex = i;
                break;
              }
            }
          }
        } else {
          for (let i = currentMsgs.length - 1; i >= 0; i--) {
            if (currentMsgs[i].role === "assistant") {
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) return;

        const assistantMsg = currentMsgs[targetIndex];
        const prevUserMsg = currentMsgs[targetIndex - 1];
        if (!prevUserMsg || prevUserMsg.role !== "user") return;

        setMessages((prev) => {
          const newMsgs = normalizeMessages(prev);
          return newMsgs.slice(0, targetIndex);
        });

        const meta = prevUserMsg.meta as Record<string, unknown> | undefined;
        const fileIds = Array.isArray(meta?.fileIds) ? (meta.fileIds as string[]) : undefined;
        const truncateClientMessageId = (assistantMsg.meta as Record<string, unknown> | undefined)
          ?.clientMessageId as string | undefined;

        await coreSend(prevUserMsg.content, {
          regenerate: true,
          skipUserAppend: true,
          truncateMessageId: assistantMsg.id,
          truncateClientMessageId,
          skipSaveUserMessage: true,
          fileIds,
        });
      } finally {
        setRegenerating(false);
      }
    },
    [coreSend, isStreaming, normalizeMessages]
  );

  const handleEdit = useCallback(
    async (originalMessage: FrontendMessage, newContent: string) => {
      if (isStreaming) return;

      // Use messagesRef to always get the latest messages (avoid stale closure)
      const currentMsgs = normalizeMessages(messagesRef.current);
      let index = currentMsgs.findIndex((m) => {
        if (m === originalMessage) return true;
        if (m.id && originalMessage.id && m.id === originalMessage.id) return true;
        if (
          !m.id &&
          !originalMessage.id &&
          m.role === originalMessage.role &&
          m.content === originalMessage.content
        ) {
          return true;
        }
        return false;
      });

      if (index === -1 && !originalMessage.id) {
        for (let i = currentMsgs.length - 1; i >= 0; i--) {
          if (
            currentMsgs[i].role === originalMessage.role &&
            currentMsgs[i].content === originalMessage.content
          ) {
            index = i;
            break;
          }
        }
      }

      if (index === -1) return;

      const meta = originalMessage.meta as Record<string, unknown> | undefined;
      const fileIds = Array.isArray(meta?.fileIds) ? (meta.fileIds as string[]) : undefined;
      const truncateClientMessageId = meta?.clientMessageId as string | undefined;

      await coreSend(newContent, {
        truncateFromIndex: index,
        regenerate: true,
        truncateMessageId: originalMessage.id,
        truncateClientMessageId,
        skipSaveUserMessage: false,
        fileIds,
      });
    },
    [coreSend, isStreaming, normalizeMessages]
  );

  const handleStop = useCallback(() => {
    // Khi bấm Stop thủ công: Lưu lại nội dung dở dang (commitPartial = true)
    cancelStream(true);
  }, [cancelStream]);

  const clearStreamError = useCallback(() => setStreamError(null), []);

  const retrySave = useCallback(
    async (msg: FrontendMessage) => {
      const clientMsgId = (msg.meta as Record<string, unknown> | undefined)?.clientMessageId as
        | string
        | undefined;
      if (!selectedConversationId || !clientMsgId || !msg.content) return;

      setMessages((prev) =>
        prev.map((m) =>
          m === msg ||
          (clientMsgId &&
            (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId)
            ? {
                ...m,
                meta: {
                  ...(m.meta as Record<string, unknown> | undefined),
                  isSaving: true,
                  saveFailed: false,
                },
              }
            : m
        )
      );

      await syncPartialMessage(
        selectedConversationId,
        clientMsgId,
        msg.content,
        (msg.meta as Record<string, unknown>) || {}
      );
    },
    [selectedConversationId, syncPartialMessage]
  );

  const handleContinue = useCallback(
    async (specificMessage?: FrontendMessage) => {
      if (isStreaming) return;

      const currentMsgs = normalizeMessages(messagesRef.current);
      const lastMsg = specificMessage || currentMsgs[currentMsgs.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant") return;

      const clientMsgId = (lastMsg.meta as Record<string, unknown> | undefined)?.clientMessageId as
        | string
        | undefined;
      const lastMeta = lastMsg.meta as Record<string, unknown> | undefined;
      let isSaved = !lastMsg.id?.startsWith("temp-") && !lastMeta?.isSaving;

      if (clientMsgId && (lastMeta?.isSaving || lastMsg.id?.startsWith("temp-"))) {
        const startTime = Date.now();
        while (Date.now() - startTime < 8000) {
          const freshMsgs = messagesRef.current;
          const target = freshMsgs.find(
            (m) =>
              (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId ||
              m.id === lastMsg.id
          );
          const targetMeta = target?.meta as Record<string, unknown> | undefined;
          if (
            target &&
            !targetMeta?.isSaving &&
            !targetMeta?.saveFailed &&
            !target.id?.startsWith("temp-")
          ) {
            isSaved = true;
            break;
          }
          if (targetMeta?.saveFailed) {
            break;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!isSaved && clientMsgId && selectedConversationId) {
        await syncPartialMessage(
          selectedConversationId,
          clientMsgId,
          lastMsg.content,
          lastMeta || {}
        );
        const fresh = messagesRef.current.find(
          (m) => (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId
        );
        const freshMeta = fresh?.meta as Record<string, unknown> | undefined;
        if (fresh && !freshMeta?.saveFailed && !fresh.id?.startsWith("temp-")) {
          isSaved = true;
        }
      }

      if (!isSaved) {
        toast.error("Không thể tiếp tục vì đoạn chat chưa được lưu vào hệ thống.");
        return;
      }

      await coreSend("Hãy tiếp tục viết tiếp phần câu trả lời còn đang dang dở ở trên.", {
        skipSaveUserMessage: false,
      });
    },
    [isStreaming, normalizeMessages, selectedConversationId, syncPartialMessage, coreSend]
  );

  return {
    messages,
    renderedMessages,
    input,
    setInput,
    creatingConversation,
    loadingMessages,
    isStreaming,
    streamingAssistant,
    streamingSources,
    streamingUrlContext,
    regenerating,
    streamError,
    clearStreamError,
    resetChatUI,
    handleNewChat,
    handleSelectConversation,
    handleSend,
    handleRegenerate,
    handleEdit,
    handleStop,
    handleContinue,
    retrySave,
    setMessages,
  };
}
