// /app/hooks/useConversation.js
"use client";

import useSWR from "swr";
import { useCallback, useEffect, useMemo, useState } from "react";

const fetcher = (url) => fetch(url).then((res) => res.json());

// ---- helpers: normalize + merge (chống SWR overwrite) ----
function toTs(v) {
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

function getTs(c) {
  return toTs(c?.updatedAt ?? c?.createdAt ?? 0);
}

function normalizeConv(c) {
  if (!c) return c;
  const createdAt = c.createdAt ?? 0;
  const updatedAt = c.updatedAt ?? createdAt;

  return {
    ...c,
    createdAt: typeof createdAt === "number" ? createdAt : toTs(createdAt),
    updatedAt: typeof updatedAt === "number" ? updatedAt : toTs(updatedAt),
  };
}

function mergeConversations(local = [], remote = []) {
  const map = new Map();

  // remote base
  for (const r of remote) {
    const rr = normalizeConv(r);
    if (rr?.id) map.set(rr.id, rr);
  }

  // overlay local (ưu tiên local nếu mới hơn / vừa patch title / vừa upsert)
  for (const l of local) {
    const ll = normalizeConv(l);
    if (!ll?.id) continue;

    const ex = map.get(ll.id);
    if (!ex) {
      map.set(ll.id, ll);
      continue;
    }

    const lts = getTs(ll);
    const rts = getTs(ex);

    map.set(ll.id, {
      ...ex,
      ...ll,
      updatedAt: Math.max(lts, rts),
      createdAt: Math.min(toTs(ll.createdAt ?? lts), toTs(ex.createdAt ?? rts)),
    });
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => getTs(b) - getTs(a));
  return merged;
}

export function useConversation() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ✅ for ChatApp.jsx compatibility
  const [creatingConversation, setCreatingConversation] = useState(false);

  const { data, mutate } = useSWR("/api/conversations", fetcher, {
    dedupingInterval: 3000,
    revalidateOnFocus: false,
  });

  // ✅ FIX: SWR về thì MERGE, không overwrite
  useEffect(() => {
    if (!data?.conversations) return;

    const remote = Array.isArray(data.conversations) ? data.conversations : [];

    setConversations((prev) => mergeConversations(prev, remote));

    // chọn activeId lần đầu (nếu chưa có)
    if (!activeId && remote.length > 0) {
      const sorted = mergeConversations([], remote);
      if (sorted[0]?.id) setActiveId(sorted[0].id);
    }
  }, [data, activeId]);

  // Upsert conversation vào list local (META conversationCreated)
  const upsertConversation = useCallback((conv) => {
    if (!conv?.id) return;

    const now = Date.now();
    const normalized = normalizeConv({
      ...conv,
      createdAt: conv.createdAt ?? now,
      updatedAt: conv.updatedAt ?? now,
    });

    setConversations((prev) => mergeConversations([normalized, ...prev], prev));
  }, []);

  // Patch title + bump updatedAt để không bị rollback
  const patchConversationTitle = useCallback((id, title) => {
    if (!id || !title?.trim()) return;
    const now = Date.now();

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === id
          ? normalizeConv({ ...c, title: title.trim(), updatedAt: now })
          : normalizeConv(c)
      );
      next.sort((a, b) => getTs(b) - getTs(a));
      return next;
    });
  }, []);

  // ✅ NEW: bump updatedAt local để sidebar reorder ngay khi user gửi message
  const bumpConversationActivity = useCallback((id, ts = Date.now()) => {
    if (!id) return;

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === id ? normalizeConv({ ...c, updatedAt: ts }) : normalizeConv(c)
      );
      next.sort((a, b) => getTs(b) - getTs(a));
      return next;
    });
  }, []);

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

  const createConversation = useCallback(
    async (options = {}) => {
      if (creatingConversation) return null;

      const title = typeof options === "string" ? options : options.title;

      setCreatingConversation(true);
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

        upsertConversation(conv);
        setActiveId(conv.id);
        setMessages([]);

        mutate();
        return conv;
      } catch (err) {
        console.error("createConversation error:", err);
        return null;
      } finally {
        setCreatingConversation(false);
      }
    },
    [creatingConversation, mutate, upsertConversation]
  );

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

        patchConversationTitle(id, updated.title);
        mutate();
      } catch (err) {
        console.error("renameConversation error:", err);
      }
    },
    [mutate, patchConversationTitle]
  );

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

        mutate();
      } catch (err) {
        console.error("deleteConversation error:", err);
      }
    },
    [activeId, mutate]
  );

  // ===== ChatApp.jsx compatibility layer (aliases) =====
  const selectedConversationId = activeId;
  const setSelectedConversationId = setActiveId;

  const refreshConversations = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const renameConversationOptimistic = useCallback(
    (id, title) => {
      patchConversationTitle(id, title);
    },
    [patchConversationTitle]
  );

  const renameConversationFinal = useCallback(
    (id, title) => {
      patchConversationTitle(id, title);
      // best-effort sync with server ordering/title
      mutate();
    },
    [mutate, patchConversationTitle]
  );

  const deleteAllConversations = useCallback(async () => {
    const ids = (Array.isArray(conversations) ? conversations : [])
      .map((c) => c?.id)
      .filter(Boolean);

    if (ids.length === 0) return;

    await Promise.all(ids.map((id) => deleteConversation(id)));

    // local safety
    setConversations([]);
    setActiveId(null);
    setMessages([]);

    mutate();
  }, [conversations, deleteConversation, mutate]);

  return {
    // core
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
    upsertConversation,
    patchConversationTitle,
    bumpConversationActivity,
    mutateConversations: mutate,

    // ChatApp.jsx expected fields
    selectedConversationId,
    setSelectedConversationId,
    creatingConversation,
    refreshConversations,
    renameConversationOptimistic,
    renameConversationFinal,
    deleteAllConversations,
  };
}
