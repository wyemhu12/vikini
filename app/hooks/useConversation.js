// app/hooks/useConversation.js
"use client";

import { useEffect, useState, useCallback } from "react";

export function useConversation() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ---------- Load list conversations ----------
  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();

      const list = Array.isArray(data.conversations)
        ? data.conversations
        : [];

      setConversations(list);

      // Nếu chưa có activeId thì chọn conv đầu tiên
      if (!activeId && list.length > 0) {
        setActiveId(list[0].id);
      }
    } catch (err) {
      console.error("loadConversations error:", err);
    } finally {
      setLoadingList(false);
    }
  }, [activeId]);

  // ---------- Load 1 conversation + messages ----------
  //      IMPORTANT: Now supports silent mode
  const loadConversation = useCallback(
    async (id, { silent = false } = {}) => {
      if (!id) return;

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const data = await res.json();

        setActiveId(id);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      } catch (err) {
        console.error("loadConversation error:", err);
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    []
  );

  // ---------- Create new conversation ----------
  const createConversation = useCallback(async (title = "New chat") => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json();

      const conv = data.conversation;
      if (!conv?.id) return;

      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      return conv;
    } catch (err) {
      console.error("createConversation error:", err);
      return null;
    }
  }, []);

  // ---------- Rename ----------
  const renameConversation = useCallback(async (id, title) => {
    if (!id || !title?.trim()) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!res.ok) throw new Error("Failed to rename conversation");
      const data = await res.json();
      const updated = data.conversation;

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
      );
    } catch (err) {
      console.error("renameConversation error:", err);
    }
  }, []);

  // ---------- Delete ----------
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

        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("deleteConversation error:", err);
      }
    },
    [activeId]
  );

  // ---------- Effects ----------

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Khi activeId thay đổi -> load messages của conv đó (normal mode)
  useEffect(() => {
    if (activeId) {
      loadConversation(activeId, { silent: false });
    }
  }, [activeId, loadConversation]);

  return {
    conversations,
    activeId,
    setActiveId,
    messages,
    setMessages,
    loadingList,
    loadingMessages,
    loadConversations,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
  };
}
