// /app/components/Chat/hooks/useChatStreamController.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function safeArray(v) {
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
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState(null);
  const [streamingSources, setStreamingSources] = useState([]);
  const [streamingUrlContext, setStreamingUrlContext] = useState([]);
  const [regenerating, setRegenerating] = useState(false);

  // AbortController để quản lý việc hủy request streaming
  const abortControllerRef = useRef(null);
  const streamingAssistantRef = useRef(streamingAssistant);

  const normalizeMessages = useCallback((arr) => {
    const safe = safeArray(arr);
    return safe
      .map((m) => ({
        id: m?.id,
        role: m?.role,
        content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
        sources: safeArray(m?.sources),
        urlContext: safeArray(m?.urlContext),
      }))
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
  const cancelStream = useCallback((commitPartial = false) => {
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
                content: streamingAssistantRef.current,
                sources: [], // Có thể chưa có sources
                urlContext: [] 
            }
        ]);
    }

    setIsStreaming(false);
    setRegenerating(false);
    setStreamingAssistant(null);
    setStreamingSources([]);
    setStreamingUrlContext([]);
  }, [normalizeMessages]);

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
    async (id) => {
      cancelStream(false); // Chuyển chat thì bỏ qua nội dung đang stream cũ
      setSelectedConversationId?.(id);
      setInput("");

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

  const coreSend = useCallback(async (text, options = {}) => {
    if (!isAuthed) return;
    if (creatingConversation) return;
    if (!text) return;

    // Hủy request cũ nếu đang chạy
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const regenerate = Boolean(options?.regenerate);
    const skipUserAppend = Boolean(options?.skipUserAppend);
    const truncateFromIndex = options?.truncateFromIndex;
    const truncateMessageId = options?.truncateMessageId;
    const skipSaveUserMessage = options?.skipSaveUserMessage;

    setInput("");
    setIsStreaming(true);
    setStreamingAssistant("");
    setStreamingSources([]);
    setStreamingUrlContext([]);

    if (typeof truncateFromIndex === "number") {
      setMessages((prev) => prev.slice(0, truncateFromIndex));
    }

    if (!skipUserAppend) {
      const userMsg = { role: "user", content: text };
      setMessages((prev) => {
        let current = normalizeMessages(prev);
        if (typeof truncateFromIndex === "number") {
          current = current.slice(0, truncateFromIndex);
        }
        return [...current, userMsg];
      });
    }

    let convId = selectedConversationId;

    if (!convId) {
      setCreatingConversation(true);
      try {
        const conv = await createConversation?.();
        convId = conv?.id;
        if (convId) setSelectedConversationId?.(convId);
      } finally {
        setCreatingConversation(false);
      }
    }

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
          skipSaveUserMessage
        }),
        signal, // Truyền signal để hủy request
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let localSources = [];
      let localUrlContext = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n").filter(Boolean);
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          const event = eventLine?.replace("event:", "").trim();
          const dataStr = dataLine?.replace("data:", "").trim();

          if (!event || !dataStr) continue;

          let data;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (event === "token") {
            const tok = data?.t || "";
            if (tok) setStreamingAssistant((prev) => (prev || "") + tok);
          }

          if (event === "meta") {
            if (data?.type === "conversationCreated" && data?.conversation?.id) {
              setSelectedConversationId?.(data.conversation.id);
              await refreshConversations?.();
            }
            if (data?.type === "optimisticTitle" && data?.title) {
                renameConversationOptimistic?.(data.conversationId, data.title || "New Chat");
            }
            if (data?.type === "finalTitle" && data?.title) {
                renameConversationFinal?.(data.conversationId, data.title || "New Chat");
            }
            if (data?.type === "sources") {
               setStreamingSources(safeArray(data?.sources));
               localSources = safeArray(data?.sources);
            }
            if (data?.type === "urlContext") {
               setStreamingUrlContext(safeArray(data?.urls));
               localUrlContext = safeArray(data?.urls);
            }
            if (data?.type === "webSearch") {
               const enabled = typeof data?.enabled === "boolean" ? data.enabled : undefined;
               const available = typeof data?.available === "boolean" ? data.available : undefined;
               if (typeof onWebSearchMeta === "function") {
                  onWebSearchMeta({ enabled, available, raw: data });
               }
            }
          }
        }
      }

      const finalAssistant = streamingAssistantRef.current || "";
      const assistantMsg = {
        role: "assistant",
        content: finalAssistant,
        sources: safeArray(localSources),
        urlContext: safeArray(localUrlContext),
      };

      setMessages((prev) => [...normalizeMessages(prev), assistantMsg]);
      setStreamingAssistant(null);

      // Reload messages from server to get correct IDs (important for regenerate/edit to work)
      // Only reload if we have a conversation ID (not for new conversations)
      if (convId) {
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
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
         console.error(e);
         setStreamingAssistant(null);
      }
      // Nếu AbortError (do bấm Stop hoặc chuyển chat), ko làm gì ở đây
      // Việc save message đã được xử lý trong handleStop (nếu gọi với commit=true)
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [
    isAuthed, creatingConversation, selectedConversationId, createConversation, 
    setSelectedConversationId, refreshConversations, normalizeMessages, 
    onWebSearchMeta, renameConversationOptimistic, renameConversationFinal
  ]);

  const handleSend = useCallback((text) => {
    coreSend(text ?? input);
  }, [coreSend, input]);

  const handleRegenerate = useCallback(async (specificMessage) => {
    if (isStreaming) return;
    setRegenerating(true);

    try {
      const currentMsgs = normalizeMessages(messages);
      let targetIndex = -1;

      if (specificMessage) {
         targetIndex = currentMsgs.findIndex(m => m === specificMessage || (m.id && m.id === specificMessage.id));
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

      setMessages(prev => {
         const newMsgs = normalizeMessages(prev);
         return newMsgs.slice(0, targetIndex);
      });

      await coreSend(prevUserMsg.content, { 
        regenerate: true, 
        skipUserAppend: true,
        truncateMessageId: assistantMsg.id,
        skipSaveUserMessage: true
      });

    } finally {
      setRegenerating(false);
    }
  }, [coreSend, isStreaming, messages, normalizeMessages]);

  const handleEdit = useCallback(async (originalMessage, newContent) => {
    if (isStreaming) return;
    
    const currentMsgs = normalizeMessages(messages);
    const index = currentMsgs.findIndex(m => m === originalMessage || (m.id && m.id === originalMessage.id));
    
    if (index === -1) return;

    await coreSend(newContent, { 
      truncateFromIndex: index, 
      regenerate: true,
      truncateMessageId: originalMessage.id,
      skipSaveUserMessage: false
    });

  }, [coreSend, isStreaming, messages, normalizeMessages]);

  const handleStop = useCallback(() => {
     // Khi bấm Stop thủ công: Lưu lại nội dung dở dang (commitPartial = true)
     cancelStream(true);
  }, [cancelStream]);

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
    resetChatUI,
    handleNewChat,
    handleSelectConversation,
    handleSend,
    handleRegenerate,
    handleEdit,
    handleStop,
  };
}
