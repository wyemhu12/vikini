// /app/features/chat/hooks/useConversation.ts
"use client";

import useSWR from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "@/lib/features/chat/conversations";
import { logger } from "@/lib/utils/logger";
import { useProjectStore } from "@/lib/store/projectStore";

interface ConversationResponse {
  conversations?: Conversation[];
  [key: string]: unknown;
}

export interface FrontendConversation {
  id: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  model?: string;
  gem?: { name: string; icon: string | null; color: string | null } | null;
  projectId?: string | null;
  [key: string]: unknown;
}

export interface FrontendMessage {
  id?: string;
  role: string;
  content: string;
  sources?: unknown[];
  urlContext?: unknown[];
  meta?: {
    imageUrl?: string;
    prompt?: string;
    originalOptions?: {
      aspectRatio?: string;
      style?: string;
      model?: string;
      enhancer?: boolean;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const fetcher = async (url: string): Promise<ConversationResponse> => {
  const res = await fetch(url);
  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error?.message || "Failed to fetch");
  }
  return json.data || json;
};

// ---- helpers: normalize + merge (chống SWR overwrite) ----
function toTs(v: unknown): number {
  if (typeof v === "number") return v;
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Converts a backend Conversation (with ISO string dates) to FrontendConversation (with timestamp numbers)
 */
function convertConversationToFrontend(conv: Conversation): FrontendConversation {
  const convertDate = (dateStr: string | null | undefined): number | undefined => {
    if (!dateStr || typeof dateStr !== "string") return undefined;
    const timestamp = Date.parse(dateStr);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  };

  return {
    id: conv.id,
    title: conv.title,
    createdAt: convertDate(conv.createdAt),
    updatedAt: convertDate(conv.updatedAt),
    model: conv.model,
    gem: conv.gem,
    projectId: conv.projectId, // Include project association
  };
}

function getTs(c: FrontendConversation | null | undefined): number {
  return toTs(c?.updatedAt ?? c?.createdAt ?? 0);
}

function normalizeConv(c: FrontendConversation | null | undefined): FrontendConversation | null {
  if (!c) return null;
  const createdAt = c.createdAt ?? 0;
  const updatedAt = c.updatedAt ?? createdAt;

  return {
    ...c,
    createdAt: typeof createdAt === "number" ? createdAt : toTs(createdAt),
    updatedAt: typeof updatedAt === "number" ? updatedAt : toTs(updatedAt),
  };
}

function mergeConversations(
  local: FrontendConversation[] = [],
  remote: FrontendConversation[] = []
): FrontendConversation[] {
  const map = new Map<string, FrontendConversation>();

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

interface UseConversationReturn {
  // core
  conversations: FrontendConversation[];
  /** Conversations without a project (personal chats) */
  personalConversations: FrontendConversation[];
  /** Get conversations for a specific project */
  getProjectConversations: (projectId: string) => FrontendConversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  messages: FrontendMessage[];
  setMessages: (messages: FrontendMessage[]) => void;
  loadingMessages: boolean;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (
    options?: { title?: string; model?: string; projectId?: string | null } | string
  ) => Promise<FrontendConversation | null>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  upsertConversation: (conv: FrontendConversation) => void;
  patchConversationTitle: (id: string, title: string) => void;
  bumpConversationActivity: (id: string, ts?: number) => void;
  mutateConversations: () => Promise<unknown>;

  // Model management
  setConversationModel: (id: string, model: string) => Promise<void>;
  patchConversationModel: (id: string, model: string) => void;

  // Gem management (optimistic update)
  patchConversationGem: (
    id: string,
    gem: { name: string; icon: string | null; color: string | null } | null
  ) => void;

  // ChatApp.jsx expected fields
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  creatingConversation: boolean;
  refreshConversations: () => Promise<void>;
  renameConversationOptimistic: (id: string, title: string) => void;
  renameConversationFinal: (id: string, title: string) => void;
  deleteAllConversations: () => Promise<void>;
}

export function useConversation(): UseConversationReturn {
  const [conversations, setConversations] = useState<FrontendConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FrontendMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Tombstone set để chặn "conversation đã xoá" bị re-add lại do merge/refresh.
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // ✅ for ChatApp.jsx compatibility
  const [creatingConversation, setCreatingConversation] = useState(false);

  const { data, mutate } = useSWR<ConversationResponse>("/api/conversations", fetcher, {
    dedupingInterval: 3000,
    revalidateOnFocus: false,
  });

  // ✅ FIX: SWR về thì MERGE, không overwrite
  useEffect(() => {
    if (!data?.conversations) return;

    const remote = Array.isArray(data.conversations) ? data.conversations : [];
    const remoteFiltered = remote
      .filter((c) => c?.id && !deletedIdsRef.current.has(c.id))
      .map((c) => convertConversationToFrontend(c as Conversation));

    setConversations((prev) => {
      const prevFiltered = (Array.isArray(prev) ? prev : []).filter(
        (c) => c?.id && !deletedIdsRef.current.has(c.id)
      );
      return mergeConversations(prevFiltered, remoteFiltered).filter(
        (c) => c?.id && !deletedIdsRef.current.has(c.id)
      );
    });

    // ✅ REMOVED: Tự động chọn activeId.
    // Chúng ta muốn ở lại Landing Page (activeId = null) khi load lại trang.
  }, [data]);

  // Upsert conversation vào list local (META conversationCreated)
  const upsertConversation = useCallback((conv: FrontendConversation) => {
    if (!conv?.id) return;

    if (deletedIdsRef.current.has(conv.id)) {
      deletedIdsRef.current.delete(conv.id);
    }

    const now = Date.now();
    const normalized = normalizeConv({
      ...conv,
      createdAt: conv.createdAt ?? now,
      updatedAt: conv.updatedAt ?? now,
    });

    if (!normalized) return;

    setConversations((prev) => {
      const prevFiltered = (Array.isArray(prev) ? prev : []).filter(
        (c) => c?.id && !deletedIdsRef.current.has(c.id)
      );
      return mergeConversations([normalized, ...prevFiltered], prevFiltered).filter(
        (c) => c?.id && !deletedIdsRef.current.has(c.id)
      );
    });
  }, []);

  // Patch title + bump updatedAt để không bị rollback
  const patchConversationTitle = useCallback((id: string, title: string) => {
    if (!id || !title?.trim()) return;
    const now = Date.now();

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === id
          ? normalizeConv({ ...c, title: title.trim(), updatedAt: now }) || c
          : normalizeConv(c) || c
      );
      next.sort((a, b) => getTs(b) - getTs(a));
      return next;
    });
  }, []);

  // ✅ NEW: Patch model locally (optimistic update)
  const patchConversationModel = useCallback((id: string, model: string) => {
    if (!id || !model) return;
    const now = Date.now();

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === id ? normalizeConv({ ...c, model, updatedAt: now }) || c : normalizeConv(c) || c
      );
      next.sort((a, b) => getTs(b) - getTs(a));
      return next;
    });
  }, []);

  // ✅ NEW: Patch gem locally (optimistic update) - fixes immediate UI update after gem selection
  const patchConversationGem = useCallback(
    (id: string, gem: { name: string; icon: string | null; color: string | null } | null) => {
      if (!id) return;
      const now = Date.now();

      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === id ? normalizeConv({ ...c, gem, updatedAt: now }) || c : normalizeConv(c) || c
        );
        next.sort((a, b) => getTs(b) - getTs(a));
        return next;
      });
    },
    []
  );

  // ✅ NEW: bump updatedAt local để sidebar reorder ngay khi user gửi message
  const bumpConversationActivity = useCallback((id: string, ts: number = Date.now()) => {
    if (!id) return;

    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === id ? normalizeConv({ ...c, updatedAt: ts }) || c : normalizeConv(c) || c
      );
      next.sort((a, b) => getTs(b) - getTs(a));
      return next;
    });
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations?id=${id}`);
      if (!res.ok) throw new Error("Failed to load conversation messages");
      const json = await res.json();
      const messages = json.data?.messages || json.messages;

      setActiveId(id);
      setMessages((Array.isArray(messages) ? messages : []) as FrontendMessage[]);
    } catch (err) {
      logger.error("loadConversation error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Get current project ID from store to link new conversations with KB
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const createConversation = useCallback(
    async (
      options: { title?: string; model?: string; projectId?: string | null } | string = {}
    ): Promise<FrontendConversation | null> => {
      if (creatingConversation) return null;

      const title = typeof options === "string" ? options : options.title;
      const model = typeof options === "string" ? undefined : options.model;
      // Use projectId from options if provided, otherwise use currentProjectId from store
      const projectId =
        typeof options === "string" ? currentProjectId : (options.projectId ?? currentProjectId);

      setCreatingConversation(true);
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "New Chat", model, projectId }),
        });

        if (!res.ok) throw new Error("Failed to create conversation");
        const json = await res.json();
        const conversationData = json.data?.conversation || json.conversation;
        const backendConv = conversationData as Conversation | undefined;
        if (!backendConv?.id) return null;

        const conv = convertConversationToFrontend(backendConv);
        upsertConversation(conv);
        setActiveId(conv.id);
        setMessages([]);

        await mutate();
        return conv;
      } catch (err) {
        logger.error("createConversation error:", err);
        return null;
      } finally {
        setCreatingConversation(false);
      }
    },
    [creatingConversation, mutate, upsertConversation, currentProjectId]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      if (!id || !title?.trim()) return;
      try {
        const res = await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, title }),
        });
        if (!res.ok) throw new Error("Failed to rename conversation");
        const json = await res.json();
        const conversationData = json.data?.conversation || json.conversation;
        const backendConv = conversationData as Conversation;
        const updated = convertConversationToFrontend(backendConv);

        patchConversationTitle(id, updated.title || title);
        await mutate();
      } catch (err) {
        logger.error("renameConversation error:", err);
      }
    },
    [mutate, patchConversationTitle]
  );

  // ✅ NEW: Set model for a conversation (server call)
  const setConversationModel = useCallback(
    async (id: string, model: string) => {
      if (!id || !model) return;
      try {
        const res = await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, model }),
        });
        if (!res.ok) throw new Error("Failed to set conversation model");
        const json = await res.json();
        const conversationData = json.data?.conversation || json.conversation;
        const backendConv = conversationData as Conversation;
        const updated = convertConversationToFrontend(backendConv);

        patchConversationModel(id, updated.model || model);
        await mutate();
      } catch (err) {
        logger.error("setConversationModel error:", err);
        throw err;
      }
    },
    [mutate, patchConversationModel]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        const res = await fetch("/api/conversations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error("Failed to delete conversation");

        deletedIdsRef.current.add(id);

        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }

        await mutate();
      } catch (err) {
        logger.error("deleteConversation error:", err);
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
    (id: string, title: string) => {
      patchConversationTitle(id, title);
    },
    [patchConversationTitle]
  );

  const renameConversationFinal = useCallback(
    (id: string, title: string) => {
      patchConversationTitle(id, title);
      mutate();
    },
    [mutate, patchConversationTitle]
  );

  const deleteAllConversations = useCallback(async () => {
    const ids = (Array.isArray(conversations) ? conversations : [])
      .map((c) => c?.id)
      .filter((id): id is string => Boolean(id));

    if (ids.length === 0) return;

    await Promise.all(ids.map((id) => deleteConversation(id)));

    setConversations([]);
    setActiveId(null);
    setMessages([]);

    await mutate();
  }, [conversations, deleteConversation, mutate]);

  // Computed: personal chats (no project) and project chats getter
  const personalConversations = conversations.filter((c) => !c.projectId);
  const getProjectConversations = useCallback(
    (projectId: string) => conversations.filter((c) => c.projectId === projectId),
    [conversations]
  );

  return {
    // core
    conversations,
    personalConversations,
    getProjectConversations,
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

    // ✅ NEW: Model management
    setConversationModel,
    patchConversationModel,

    // ✅ NEW: Gem management (optimistic update)
    patchConversationGem,

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
