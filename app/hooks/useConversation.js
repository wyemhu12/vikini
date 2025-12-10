// app/hooks/useConversation.js
"use client";

import useSWR from "swr";
import { useCallback, useEffect, useState } from "react";

const fetcher = (url) => fetch(url).then((res) => res.json());

export function useConversation() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // SWR for conversation list
  const { data, mutate } = useSWR("/api/conversations", fetcher, {
    dedupingInterval: 3000, // align với TTL cache server
    revalidateOnFocus: false,
  });

  // Khi data từ SWR về -> sync vào state local
  useEffect(() => {
    if (!data?.conversations) return;
    setConversations(data.conversations);

    if (!activeId && data.conversations.length > 0) {
      setActiveId(data.conversations[0].id);
    }
  }, [data, activeId]);

  // Load messages for a conversation
  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations?id=${id}`);
      if (!res.ok) throw new Error("Failed to load conversation messages");
      const json = await res.json();

      setActiveId(id);
      setMessages(Array.isArray(json.messages) ? json.messages : []);
    } catch (err) {
      console.error("loadConversation error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Create new conversation
  const createConversation = useCallback(
    async (options = {}) => {
      const title = typeof options === "string" ? options : options.title;

      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "New Chat" }),
        });

        if (!res.ok) throw new Error("Failed to create conversation");
        const json = await res.json();
        const conv = json.conversation;
        if (!conv?.id) return null;

        // Patch local list ngay lập tức (optimistic)
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        setMessages([]);

        // Revalidate SWR trong background
        mutate();

        return conv;
      } catch (err) {
        console.error("createConversation error:", err);
        return null;
      }
    },
    [mutate]
  );

  // Rename conversation
  const renameConversation = useCallback(
    async (id, title) => {
      if (!id || !title?.trim()) return;
      try {
        const res = await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, title }),
        });
        if (!res.ok) throw new Error("Failed to rename conversation");
        const json = await res.json();
        const updated = json.conversation;

        // Patch local
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
        );

        // Revalidate background
        mutate();
      } catch (err) {
        console.error("renameConversation error:", err);
      }
    },
    [mutate]
  );

  // Delete conversation
  const deleteConversation = useCallback(
    async (id) => {
      if (!id) return;
      try {
        const res = await fetch("/api/conversations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error("Failed to delete conversation");

        // Patch local
        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }

        mutate();
      } catch (err) {
        console.error("deleteConversation error:", err);
      }
    },
    [activeId, mutate]
  );

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    setMessages,
    loadingMessages,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
  };
}
