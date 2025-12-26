// /app/components/Chat/hooks/useChatStreamController.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Chat state machine + SSE streaming parser extracted from ChatApp.jsx.
 *
 * Responsibilities:
 * - Local messages/input state used by the Chat UI.
 * - Conversation selection & message loading.
 * - Message send + regenerate via /api/chat-stream (text/event-stream).
 * - Emits server meta updates (e.g., webSearch enabled/available) via callback.
 */
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

  const streamingAssistantRef = useRef(streamingAssistant);
  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  const resetChatUI = useCallback(() => {
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    setStreamingAssistant(null);
    setStreamingSources([]);
    setStreamingUrlContext([]);
    setRegenerating(false);
  }, []);

  const handleNewChat = useCallback(async () => {
    const conv = await createConversation?.();
    if (conv?.id) {
      setSelectedConversationId?.(conv.id);
      resetChatUI();
    }
  }, [createConversation, resetChatUI, setSelectedConversationId]);

  const handleSelectConversation = useCallback(
    async (id) => {
      setSelectedConversationId?.(id);
      setStreamingAssistant(null);
      setStreamingSources([]);
      setStreamingUrlContext([]);
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
    [normalizeMessages, setSelectedConversationId]
  );

  const handleSend = useCallback(
    async (overrideText, options = {}) => {
      if (!isAuthed) return;
      if (creatingConversation) return;

      const text = (overrideText ?? input).trim();
      if (!text) return;

      const regenerate = Boolean(options?.regenerate);
      const skipUserAppend = Boolean(options?.skipUserAppend);

      setInput("");
      setIsStreaming(true);
      setStreamingAssistant("");
      setStreamingSources([]);
      setStreamingUrlContext([]);

      if (!skipUserAppend) {
        const userMsg = { role: "user", content: text };
        setMessages((prev) => [...normalizeMessages(prev), userMsg]);
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
          }),
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
                const nextSources = safeArray(data?.sources);
                localSources = nextSources;
                setStreamingSources(nextSources);
              }

              if (data?.type === "urlContext") {
                const nextUrls = safeArray(data?.urls);
                localUrlContext = nextUrls;
                setStreamingUrlContext(nextUrls);
              }

              if (data?.type === "webSearch") {
                const enabled = typeof data?.enabled === "boolean" ? data.enabled : undefined;
                const available =
                  typeof data?.available === "boolean" ? data.available : undefined;
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
        setStreamingSources([]);
        setStreamingUrlContext([]);
      } catch (e) {
        console.error(e);
        setStreamingAssistant(null);
        setStreamingSources([]);
        setStreamingUrlContext([]);
      } finally {
        setIsStreaming(false);
      }
    },
    [
      isAuthed,
      creatingConversation,
      input,
      selectedConversationId,
      createConversation,
      setSelectedConversationId,
      refreshConversations,
      renameConversationOptimistic,
      renameConversationFinal,
      normalizeMessages,
      onWebSearchMeta,
    ]
  );

  const handleRegenerate = useCallback(async () => {
    if (!selectedConversationId) return;
    if (isStreaming) return;

    setRegenerating(true);

    try {
      const safe = normalizeMessages(messages);
      const lastUser = [...safe].reverse().find((m) => m.role === "user");
      if (!lastUser?.content) return;

      setMessages((prev) => {
        const arr = normalizeMessages(prev);
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i]?.role === "assistant") {
            return [...arr.slice(0, i), ...arr.slice(i + 1)];
          }
        }
        return arr;
      });

      await handleSend(lastUser.content, { regenerate: true, skipUserAppend: true });
    } finally {
      setRegenerating(false);
    }
  }, [handleSend, isStreaming, messages, normalizeMessages, selectedConversationId]);

  return {
    // State
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

    // Actions
    resetChatUI,
    handleNewChat,
    handleSelectConversation,
    handleSend,
    handleRegenerate,
  };
}
