// /app/hooks/useConversation.js
"use client";

import useSWR from "swr";
import { useCallback, useEffect, useState } from "react";

const fetcher = (url) => fetch(url).then((res) => res.json());

// ---- helpers: stable timestamp + merge strategy ----
function getTs(c) {
  // backend có thể trả updatedAt/createdAt dạng number hoặc string ISO
  const raw = c?.updatedAt ?? c?.createdAt ?? 0;
  if (typeof raw === "number") return raw;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function normalizeConv(c) {
  if (!c) return c;
  // đảm bảo luôn có createdAt/updatedAt dạng number (để sort/merge ổn định)
  const createdAt = c.createdAt ?? 0;
  const updatedAt = c.updatedAt ?? createdAt;
  return {
    ...c,
    createdAt: typeof createdAt === "number" ? createdAt : getTs({ createdAt }),
    updatedAt: typeof updatedAt === "number" ? updatedAt : getTs({ updatedAt }),
  };
}

function mergeConversations(local = [], remote = []) {
  // Ưu tiên local khi:
  // - local có updatedAt mới hơn
  // - hoặc local có title khác remote (ví dụ vừa patch finalTitle)
  // - hoặc local có field bổ sung
  const map = new Map();

  for (const r of remote) {
    const rr = normalizeConv(r);
    if (rr?.id) map.set(rr.id, rr);
  }

  for (const l of local) {
    const ll = normalizeConv(l);
    if (!ll?.id) continue;

    const existing = map.get(ll.id);
    if (!existing) {
      map.set(ll.id, ll);
      continue;
    }

    const lts = getTs(ll);
    const rts = getTs(existing);

    // merge: base = remote, overlay = local (để giữ optimistic patch)
    // nhưng nếu remote mới hơn rõ ràng, vẫn giữ remote.updatedAt
    const merged = {
      ...existing,
      ...ll,
      updatedAt: Math.max(lts, rts),
      createdAt: Math.min(
        getTs({ createdAt: ll.createdAt ?? lts }),
        getTs({ createdAt: existing.createdAt ?? rts })
      ),
    };

    map.set(ll.id, merged);
  }

  const mergedList = Array.from(map.values());

  // sort DESC by updatedAt, fallback createdAt
  mergedList.sort((a, b) => getTs(b) - getTs(a));

  return mergedList;
}

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

  // Khi data từ SWR về -> MERGE vào state local (KHÔNG overwrite)
  useEffect(() => {
    if (!data?.conversations) return;

    const remote = Array.isArray(data.conversations) ? data.conversations : [];

    setConversations((prev) => {
      const next = mergeConversations(prev, remote);
      return next;
    });

    // Chỉ auto-select khi thật sự chưa có activeId
    // và sau khi merge đã có list
    if (!activeId && remote.length > 0) {
      const sorted = mergeConversations([], remote);
      if (sorted[0]?.id) setActiveId(sorted[0].id);
    }
  }, [data, activeId]);

  // Upsert conversation vào list local (dùng cho META conversationCreated)
  const upsertConversation = useCallback((conv) => {
    if (!conv?.id) return;

    const now = Date.now();
    const normalized = normalizeConv({
      ...conv,
      // bump updatedAt local để đảm bảo đứng đầu list ngay lập tức
      updatedAt: conv.updatedAt ?? now,
      createdAt: conv.createdAt ?? now,
    });

    setConversations((prev) => {
      const next = mergeConversations([normalized, ...prev], prev);
      // mergeConversations([new,...prev], prev) sẽ giữ new và dedupe theo id
      return next;
    });
  }, []);

  // Patch title vào local list (khi nhận finalTitle)
  const patchConversationTitle = useCallback((id, title) => {
    if (!id || !title?.trim()) return;

    const now = Date.now();
    setConversations((prev) => {
      const patched = prev.map((c) =>
        c.id === id
          ? normalizeConv({
              ...c,
              title: title.trim(),
              // bump updatedAt để list re-sort + tránh SWR rollback
              updatedAt: now,
            })
          : normalizeConv(c)
      );

      patched.sort((a, b) => getTs(b) - getTs(a));
      return patched;
    });
  }, []);

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

        // Patch local list ngay lập tức
        upsertConversation(conv);

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
    [mutate, upsertConversation]
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

        // Patch local + bump updatedAt
        patchConversationTitle(id, updated.title);

        // Revalidate background
        mutate();
      } catch (err) {
        console.error("renameConversation error:", err);
      }
    },
    [mutate, patchConversationTitle]
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

    // helpers
    upsertConversation,
    patchConversationTitle,
    mutateConversations: mutate,
  };
}
