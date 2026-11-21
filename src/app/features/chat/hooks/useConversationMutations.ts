"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Conversation } from "@/lib/features/chat/conversations";
import {
  convertConversationToFrontend,
  type CreateConversationOptions,
  type FrontendConversation,
  type FrontendMessage,
} from "@/lib/features/chat/conversationListHelpers";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

export interface UseConversationMutationsParams {
  conversations: FrontendConversation[];
  activeId: string | null;
  creatingConversation: boolean;
  currentProjectId: string | null;
  deletedIdsRef: MutableRefObject<Set<string>>;
  setConversations: Dispatch<SetStateAction<FrontendConversation[]>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setMessages: Dispatch<SetStateAction<FrontendMessage[]>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setCreatingConversation: Dispatch<SetStateAction<boolean>>;
  upsertConversation: (conv: FrontendConversation) => void;
  patchConversationTitle: (id: string, title: string) => void;
  patchConversationModel: (id: string, model: string) => void;
  mutate: () => Promise<unknown>;
  t: (key: string) => string;
}

export function useConversationMutations({
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
}: UseConversationMutationsParams) {
  const loadConversation = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok) throw new Error("Failed to load conversation messages");
        const json = await res.json();
        const loaded = json.data?.messages || json.messages;

        setActiveId(id);
        setMessages((Array.isArray(loaded) ? loaded : []) as FrontendMessage[]);
      } catch (err: unknown) {
        logger.error("loadConversation error:", err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [setActiveId, setLoadingMessages, setMessages]
  );

  const createConversation = useCallback(
    async (options: CreateConversationOptions = {}): Promise<FrontendConversation | null> => {
      if (creatingConversation) return null;

      const title = typeof options === "string" ? options : options.title;
      const model = typeof options === "string" ? undefined : options.model;
      const projectId =
        typeof options === "string"
          ? currentProjectId
          : "projectId" in options
            ? (options.projectId ?? null)
            : currentProjectId;

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
        if (typeof options !== "string") {
          options.onBeforeActivate?.(conv.id);
        }
        upsertConversation(conv);
        setActiveId(conv.id);
        setMessages([]);

        await mutate();
        return conv;
      } catch (err: unknown) {
        logger.error("createConversation error:", err);
        toast.error(t("createChatFailed"));
        return null;
      } finally {
        setCreatingConversation(false);
      }
    },
    [
      creatingConversation,
      currentProjectId,
      mutate,
      setActiveId,
      setCreatingConversation,
      setMessages,
      t,
      upsertConversation,
    ]
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
        const updated = convertConversationToFrontend(conversationData as Conversation);

        patchConversationTitle(id, updated.title || title);
        await mutate();
        toast.success(t("renameChatSuccess"));
      } catch (err: unknown) {
        logger.error("renameConversation error:", err);
        toast.error(t("renameChatFailed"));
        await mutate();
      }
    },
    [mutate, patchConversationTitle, t]
  );

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
        const updated = convertConversationToFrontend(conversationData as Conversation);

        patchConversationModel(id, updated.model || model);
        await mutate();
      } catch (err: unknown) {
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

        toast.success(t("deleteChatSuccess"));
        await mutate();
      } catch (err: unknown) {
        logger.error("deleteConversation error:", err);
        toast.error(t("deleteChatFailed2"));
      }
    },
    [activeId, deletedIdsRef, mutate, setActiveId, setConversations, setMessages, t]
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
  }, [conversations, deleteConversation, mutate, setActiveId, setConversations, setMessages]);

  return {
    loadConversation,
    createConversation,
    renameConversation,
    setConversationModel,
    deleteConversation,
    deleteAllConversations,
  };
}
