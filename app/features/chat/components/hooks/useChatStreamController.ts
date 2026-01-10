// /app/components/Chat/hooks/useChatStreamController.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface StreamError {
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
  skipSaveUserMessage?: boolean;
}

function safeArray<T>(v: T[] | unknown): T[] {
  return Array.isArray(v) ? v : [];
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
  const [input, setInput] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<unknown[]>([]);
  const [streamingUrlContext, setStreamingUrlContext] = useState<unknown[]>([]);
  const [regenerating, setRegenerating] = useState(false);
  const [streamError, setStreamError] = useState<StreamError | null>(null);

  // AbortController để quản lý việc hủy request streaming
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingAssistantRef = useRef<string | null>(streamingAssistant);

  const normalizeMessages = useCallback((arr: FrontendMessage[] | unknown): FrontendMessage[] => {
    const safe = safeArray<FrontendMessage>(arr);
    return safe
      .map(
        (m): FrontendMessage => ({
          id: m?.id,
          role: m?.role || "",
          content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
          sources: safeArray(m?.sources),
          urlContext: safeArray(m?.urlContext),
          meta: m?.meta,
        })
      )
      .filter((m) => m.role === "user" || m.role === "assistant");
  }, []);

  const renderedMessages = useMemo(
    () => normalizeMessages(messages),
    [messages, normalizeMessages]
  );

  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  // Hủy request và tùy chọn lưu lại nội dung đang stream dở
  const cancelStream = useCallback(
    (commitPartial = false) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Nếu được yêu cầu lưu nội dung dở dang và có nội dung
      if (commitPartial && streamingAssistantRef.current) {
        setMessages((prev) => [
          ...normalizeMessages(prev),
          {
            role: "assistant",
            content: streamingAssistantRef.current || "",
            sources: [], // Có thể chưa có sources
            urlContext: [],
          },
        ]);
      }

      setIsStreaming(false);
      setRegenerating(false);
      setStreamingAssistant(null);
      setStreamingSources([]);
      setStreamingUrlContext([]);
    },
    [normalizeMessages]
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
        return;
      }

      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const data = await res.json();
        setMessages(normalizeMessages(data?.messages));
      } catch (e) {
        console.error(e);
        setMessages([]);
      }
    },
    [normalizeMessages, setSelectedConversationId, cancelStream]
  );

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

      // Hủy request cũ nếu đang chạy
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setInput("");
      setIsStreaming(true);
      setStreamingAssistant("");
      setStreamingSources([]);
      setStreamingUrlContext([]);

      if (typeof truncateFromIndex === "number") {
        setMessages((prev) => prev.slice(0, truncateFromIndex));
      }

      if (!skipUserAppend) {
        const userMsg: FrontendMessage = { role: "user", content: text };
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
      // Error fields
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
      }
      if (data?.type === "urlContext") {
        const urls = safeArray(data?.urls);
        setStreamingUrlContext(urls);
        localUrlContext.current = urls;
      }
      if (data?.type === "webSearch") {
        const enabled = typeof data?.enabled === "boolean" ? data.enabled : undefined;
        const available = typeof data?.available === "boolean" ? data.available : undefined;
        if (typeof onWebSearchMeta === "function") {
          onWebSearchMeta({ enabled, available, raw: data });
        }
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
            if (tok) setStreamingAssistant((prev) => (prev || "") + tok);
          }

          if (event === "meta") {
            await handleStreamMetaEvent(data, localSources, localUrlContext);
          }

          // Handle error events from backend
          if (event === "error") {
            const errorData: StreamError = {
              message: data?.message || "An error occurred",
              code: data?.code,
              status: data?.status,
              isTokenLimit: data?.isTokenLimit,
              tokenInfo: data?.tokenInfo,
            };
            setStreamError(errorData);
            onStreamError?.(errorData);
          }
        }
      }
    },
    [handleStreamMetaEvent, onStreamError]
  );

  const reloadMessagesAfterStream = useCallback(
    async (convId: string | null) => {
      if (!convId) return;

      try {
        const res = await fetch(`/api/conversations?id=${convId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.messages && Array.isArray(data.messages)) {
            setMessages(normalizeMessages(data.messages));
          }
        }
      } catch (reloadError) {
        // Non-critical: if reload fails, continue with local state
        console.warn("Failed to reload messages after stream:", reloadError);
      }
    },
    [normalizeMessages]
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

      try {
        const res = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            conversationId: convId,
            content: text,
            regenerate,
            truncateMessageId,
            skipSaveUserMessage,
          }),
          signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const localSources = { current: [] as unknown[] };
        const localUrlContext = { current: [] as unknown[] };

        await processStreamResponse(reader, localSources, localUrlContext);

        const finalAssistant = streamingAssistantRef.current || "";
        const assistantMsg: FrontendMessage = {
          role: "assistant",
          content: finalAssistant,
          sources: safeArray(localSources.current),
          urlContext: safeArray(localUrlContext.current),
        };

        setMessages((prev) => [...normalizeMessages(prev), assistantMsg]);
        setStreamingAssistant(null);

        await reloadMessagesAfterStream(convId);
      } catch (e) {
        const error = e as Error & { name?: string };
        if (error.name !== "AbortError") {
          console.error(e);
          setStreamingAssistant(null);
        }
        // Nếu AbortError (do bấm Stop hoặc chuyển chat), ko làm gì ở đây
        // Việc save message đã được xử lý trong handleStop (nếu gọi với commit=true)
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
      reloadMessagesAfterStream,
      normalizeMessages,
    ]
  );

  const handleSend = useCallback(
    (text?: string) => {
      coreSend(text ?? input);
    },
    [coreSend, input]
  );

  const handleRegenerate = useCallback(
    async (specificMessage?: FrontendMessage) => {
      if (isStreaming) return;
      setRegenerating(true);

      try {
        const currentMsgs = normalizeMessages(messages);
        let targetIndex = -1;

        if (specificMessage) {
          targetIndex = currentMsgs.findIndex(
            (m) => m === specificMessage || (m.id && m.id === specificMessage.id)
          );
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

        await coreSend(prevUserMsg.content, {
          regenerate: true,
          skipUserAppend: true,
          truncateMessageId: assistantMsg.id,
          skipSaveUserMessage: true,
        });
      } finally {
        setRegenerating(false);
      }
    },
    [coreSend, isStreaming, messages, normalizeMessages]
  );

  const handleEdit = useCallback(
    async (originalMessage: FrontendMessage, newContent: string) => {
      if (isStreaming) return;

      const currentMsgs = normalizeMessages(messages);
      const index = currentMsgs.findIndex(
        (m) => m === originalMessage || (m.id && m.id === originalMessage.id)
      );

      if (index === -1) return;

      await coreSend(newContent, {
        truncateFromIndex: index,
        regenerate: true,
        truncateMessageId: originalMessage.id,
        skipSaveUserMessage: false,
      });
    },
    [coreSend, isStreaming, messages, normalizeMessages]
  );

  const handleStop = useCallback(() => {
    // Khi bấm Stop thủ công: Lưu lại nội dung dở dang (commitPartial = true)
    cancelStream(true);
  }, [cancelStream]);

  const clearStreamError = useCallback(() => setStreamError(null), []);

  return {
    messages,
    renderedMessages,
    input,
    setInput,
    creatingConversation,
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
  };
}
