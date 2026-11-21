// /app/features/chat/hooks/useConversation.ts
"use client";

import useSWR from "swr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Conversation } from "@/lib/features/chat/conversations";
import {
  convertConversationToFrontend,
  mergeConversations,
  normalizeConv,
  patchConversationListItem,
  type ConversationResponse,
  type CreateConversationOptions,
  type FrontendConversation,
  type FrontendMessage,
} from "@/lib/features/chat/conversationListHelpers";
import { useProjectStore } from "@/lib/store/projectStore";
import { useLanguage } from "./useLanguage";
import { useConversationMutations } from "./useConversationMutations";

export type { FrontendConversation, FrontendMessage };

const fetcher = async (url: string): Promise<ConversationResponse> => {
  const res = await fetch(url);
  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error?.message || "Failed to fetch");
  }
  return json.data || json;
};

interface UseConversationReturn {
  conversations: FrontendConversation[];
  personalConversations: FrontendConversation[];
  getProjectConversations: (projectId: string) => FrontendConversation[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  messages: FrontendMessage[];
  setMessages: (messages: FrontendMessage[]) => void;
  loadingMessages: boolean;
  isLoadingConversations: boolean;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (options?: CreateConversationOptions) => Promise<FrontendConversation | null>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  upsertConversation: (conv: FrontendConversation) => void;
  patchConversationTitle: (id: string, title: string) => void;
  bumpConversationActivity: (id: string, ts?: number) => void;
  mutateConversations: () => Promise<unknown>;
  setConversationModel: (id: string, model: string) => Promise<void>;
  patchConversationModel: (id: string, model: string) => void;
  patchConversationGem: (
    id: string,
    gem: { name: string; icon: string | null; color: string | null } | null
  ) => void;
  patchConversationPersona: (
    id: string,
    persona: { name: string; icon: string | null; color: string | null } | null
  ) => void;
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
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [conversationsSynced, setConversationsSynced] = useState(false);
  const { t } = useLanguage();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // Tombstone set to block deleted conversations from being re-added on SWR refresh.
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const { data, error, mutate } = useSWR<ConversationResponse>("/api/conversations", fetcher, {
    dedupingInterval: 3000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  useEffect(() => {
    if (data === undefined) return;
    if (data.conversations) {
      const remote = Array.isArray(data.conversations) ? data.conversations : [];
      const remoteFiltered = remote
        .filter((c) => c?.id && !deletedIdsRef.current.has(c.id))
        .map((c) => convertConversationToFrontend(c as Conversation));

      setConversations((prev) =>
        mergeConversations(Array.isArray(prev) ? prev : [], remoteFiltered, deletedIdsRef.current)
      );
    }
    setConversationsSynced(true);
  }, [data]);

  useEffect(() => {
    if (error) setConversationsSynced(true);
  }, [error]);

  const upsertConversation = useCallback((conv: FrontendConversation) => {
    if (!conv?.id) return;
    deletedIdsRef.current.delete(conv.id);

    const now = Date.now();
    const normalized = normalizeConv({
      ...conv,
      createdAt: conv.createdAt ?? now,
      updatedAt: conv.updatedAt ?? now,
    });
    if (!normalized) return;

    setConversations((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      return mergeConversations([normalized, ...safePrev], safePrev, deletedIdsRef.current);
    });
  }, []);

  const patchConversationTitle = useCallback((id: string, title: string) => {
    if (!id || !title?.trim()) return;
    setConversations((prev) => patchConversationListItem(prev, id, { title: title.trim() }));
  }, []);

  const patchConversationModel = useCallback((id: string, model: string) => {
    if (!id || !model) return;
    setConversations((prev) => patchConversationListItem(prev, id, { model }));
  }, []);

  const patchConversationGem = useCallback(
    (id: string, gem: { name: string; icon: string | null; color: string | null } | null) => {
      if (!id) return;
      setConversations((prev) => patchConversationListItem(prev, id, { gem }));
    },
    []
  );

  const patchConversationPersona = useCallback(
    (id: string, persona: { name: string; icon: string | null; color: string | null } | null) => {
      if (!id) return;
      setConversations((prev) => patchConversationListItem(prev, id, { persona }));
    },
    []
  );

  const bumpConversationActivity = useCallback((id: string, ts: number = Date.now()) => {
    if (!id) return;
    setConversations((prev) => patchConversationListItem(prev, id, {}, ts));
  }, []);

  const mutations = useConversationMutations({
    conversations,
    activeId,
    creatingConversation,
    currentProjectId,
    deletedIdsRef,
    setConversations,
    setActiveId,
    setMessages,
    setLoadingMessages,
    setCreatingConversation,
    upsertConversation,
    patchConversationTitle,
    patchConversationModel,
    mutate,
    t,
  });

  const refreshConversations = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const renameConversationOptimistic = useCallback(
    (id: string, title: string) => patchConversationTitle(id, title),
    [patchConversationTitle]
  );

  const renameConversationFinal = useCallback(
    (id: string, title: string) => {
      patchConversationTitle(id, title);
      void mutate();
    },
    [mutate, patchConversationTitle]
  );

  const personalConversations = useMemo(
    () => conversations.filter((c) => !c.projectId),
    [conversations]
  );
  const getProjectConversations = useCallback(
    (projectId: string) => conversations.filter((c) => c.projectId === projectId),
    [conversations]
  );

  return {
    conversations,
    personalConversations,
    getProjectConversations,
    activeId,
    setActiveId,
    messages,
    setMessages,
    loadingMessages,
    isLoadingConversations: !conversationsSynced,
    ...mutations,
    upsertConversation,
    patchConversationTitle,
    bumpConversationActivity,
    mutateConversations: mutate,
    patchConversationModel,
    patchConversationGem,
    patchConversationPersona,
    selectedConversationId: activeId,
    setSelectedConversationId: setActiveId,
    creatingConversation,
    refreshConversations,
    renameConversationOptimistic,
    renameConversationFinal,
  };
}
