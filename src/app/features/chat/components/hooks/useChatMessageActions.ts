"use client";

import { useCallback, useEffect } from "react";
import { logger } from "@/lib/utils/logger";
import {
  countContextOnlyMessages,
  findMessageIndex,
  normalizeFrontendMessages,
  type ChatFrontendMessage,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";
import type { UseChatMessageActionsParams } from "./chatStreamHookTypes";

export type { UseChatMessageActionsParams };

export function useChatMessageActions(params: UseChatMessageActionsParams) {
  const {
    selectedConversationId,
    loadingMessages,
    isStreaming,
    messagesLength,
    messagesRef,
    activeConvIdRef,
    prevConversationIdRef,
    loadAbortRef,
    isUnmountedRef,
    tRef,
    setSelectedConversationId,
    createConversation,
    setMessages,
    setContextMessagesCount,
    setInput,
    setLoadingMessages,
    setRegenerating,
    cancelStream,
    coreSend,
    waitForPartialMessageSaved,
  } = params;

  const fetchConversationMessages = useCallback(
    async (id: string) => {
      loadAbortRef.current?.abort();
      const controller = new AbortController();
      loadAbortRef.current = controller;

      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load conversation");
        const json = await res.json();
        if (isUnmountedRef.current || controller.signal.aborted || activeConvIdRef.current !== id) {
          return;
        }
        const data = json.data || json;
        setContextMessagesCount(countContextOnlyMessages(data?.messages));
        setMessages(normalizeFrontendMessages(data?.messages));
      } catch (e: unknown) {
        const errName = e instanceof Error ? e.name : (e as { name?: string } | null)?.name;
        if (errName === "AbortError" || controller.signal.aborted) {
          return;
        }
        if (isUnmountedRef.current || activeConvIdRef.current !== id) {
          return;
        }
        logger.error("Failed to load messages:", e);
        toast.error(tRef.current("loadMessagesFailed"));
        setContextMessagesCount(0);
        setMessages([]);
      } finally {
        if (loadAbortRef.current === controller) {
          loadAbortRef.current = null;
          if (!isUnmountedRef.current) setLoadingMessages(false);
        }
      }
    },
    [
      activeConvIdRef,
      isUnmountedRef,
      loadAbortRef,
      setContextMessagesCount,
      setLoadingMessages,
      setMessages,
      tRef,
    ]
  );

  const resetChatUI = useCallback(() => {
    cancelStream(false);
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    setMessages([]);
    setContextMessagesCount(0);
    setInput("");
  }, [cancelStream, loadAbortRef, setContextMessagesCount, setInput, setMessages]);

  const handleNewChat = useCallback(async () => {
    cancelStream(false);
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    const conv = await createConversation?.();
    if (conv?.id && !isUnmountedRef.current) {
      activeConvIdRef.current = conv.id;
      prevConversationIdRef.current = conv.id;
      setSelectedConversationId?.(conv.id);
      resetChatUI();
    }
  }, [
    activeConvIdRef,
    cancelStream,
    createConversation,
    isUnmountedRef,
    loadAbortRef,
    prevConversationIdRef,
    resetChatUI,
    setSelectedConversationId,
  ]);

  const handleSelectConversation = useCallback(
    async (id: string | null) => {
      cancelStream(false);
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
      activeConvIdRef.current = id;
      prevConversationIdRef.current = id;
      setSelectedConversationId?.(id);
      setInput("");

      if (!id) {
        setMessages([]);
        setContextMessagesCount(0);
        setLoadingMessages(false);
        return;
      }

      await fetchConversationMessages(id);
    },
    [
      activeConvIdRef,
      cancelStream,
      fetchConversationMessages,
      loadAbortRef,
      prevConversationIdRef,
      setContextMessagesCount,
      setInput,
      setLoadingMessages,
      setMessages,
      setSelectedConversationId,
    ]
  );

  useEffect(() => {
    if (!selectedConversationId || loadingMessages || isStreaming) return;
    if (prevConversationIdRef.current === selectedConversationId) return;

    prevConversationIdRef.current = selectedConversationId;
    activeConvIdRef.current = selectedConversationId;
    void fetchConversationMessages(selectedConversationId);
  }, [
    selectedConversationId,
    loadingMessages,
    isStreaming,
    messagesLength,
    activeConvIdRef,
    prevConversationIdRef,
    fetchConversationMessages,
  ]);

  const handleRegenerate = useCallback(
    async (specificMessage?: ChatFrontendMessage) => {
      if (isStreaming) return;
      setRegenerating(true);

      try {
        const currentMsgs = normalizeFrontendMessages(messagesRef.current);
        let targetIndex = -1;

        if (specificMessage) {
          targetIndex = findMessageIndex(currentMsgs, specificMessage);
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

        setMessages((prev) => normalizeFrontendMessages(prev).slice(0, targetIndex));

        const meta = prevUserMsg.meta as Record<string, unknown> | undefined;
        const fileIds = Array.isArray(meta?.fileIds) ? (meta.fileIds as string[]) : undefined;
        const truncateClientMessageId = (assistantMsg.meta as Record<string, unknown> | undefined)
          ?.clientMessageId as string | undefined;

        await coreSend(prevUserMsg.content, {
          regenerate: true,
          skipUserAppend: true,
          truncateMessageId: assistantMsg.id,
          truncateClientMessageId,
          skipSaveUserMessage: true,
          fileIds,
        });
      } finally {
        setRegenerating(false);
      }
    },
    [coreSend, isStreaming, messagesRef, setMessages, setRegenerating]
  );

  const handleEdit = useCallback(
    async (originalMessage: ChatFrontendMessage, newContent: string) => {
      if (isStreaming) return;

      const currentMsgs = normalizeFrontendMessages(messagesRef.current);
      const index = findMessageIndex(currentMsgs, originalMessage);
      if (index === -1) return;

      const meta = originalMessage.meta as Record<string, unknown> | undefined;
      const fileIds = Array.isArray(meta?.fileIds) ? (meta.fileIds as string[]) : undefined;
      const truncateClientMessageId = meta?.clientMessageId as string | undefined;

      await coreSend(newContent, {
        truncateFromIndex: index,
        regenerate: true,
        truncateMessageId: originalMessage.id,
        truncateClientMessageId,
        skipSaveUserMessage: false,
        fileIds,
      });
    },
    [coreSend, isStreaming, messagesRef]
  );

  const handleContinue = useCallback(
    async (specificMessage?: ChatFrontendMessage) => {
      if (isStreaming) return;

      const currentMsgs = normalizeFrontendMessages(messagesRef.current);
      const lastMsg = specificMessage || currentMsgs[currentMsgs.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant") return;

      const isSaved = await waitForPartialMessageSaved(lastMsg);
      if (!isSaved) {
        toast.error(tRef.current("continueFailedNotSaved"));
        return;
      }

      await coreSend(tRef.current("continuePrompt"), { skipSaveUserMessage: false });
    },
    [coreSend, isStreaming, messagesRef, tRef, waitForPartialMessageSaved]
  );

  return {
    resetChatUI,
    handleNewChat,
    handleSelectConversation,
    handleRegenerate,
    handleEdit,
    handleContinue,
  };
}
