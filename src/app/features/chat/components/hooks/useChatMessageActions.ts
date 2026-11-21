"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { logger } from "@/lib/utils/logger";
import {
  findMessageIndex,
  normalizeFrontendMessages,
  type ChatFrontendMessage,
  type CoreSendOptions,
} from "@/lib/features/chat/streamProtocol";
import { toast } from "@/lib/store/toastStore";

export interface UseChatMessageActionsParams {
  selectedConversationId: string | null;
  loadingMessages: boolean;
  isStreaming: boolean;
  messagesLength: number;
  messagesRef: MutableRefObject<ChatFrontendMessage[]>;
  prevConversationIdRef: MutableRefObject<string | null>;
  tRef: MutableRefObject<(key: string) => string>;
  setSelectedConversationId?: (id: string | null) => void;
  createConversation?: () => Promise<{ id: string; [key: string]: unknown } | null>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setInput: Dispatch<SetStateAction<string>>;
  setLoadingMessages: Dispatch<SetStateAction<boolean>>;
  setRegenerating: Dispatch<SetStateAction<boolean>>;
  cancelStream: (commitPartial?: boolean) => void;
  coreSend: (text: string, options?: CoreSendOptions) => Promise<void>;
  waitForPartialMessageSaved: (lastMsg: ChatFrontendMessage) => Promise<boolean>;
}

export function useChatMessageActions(params: UseChatMessageActionsParams) {
  const {
    selectedConversationId,
    loadingMessages,
    isStreaming,
    messagesLength,
    messagesRef,
    prevConversationIdRef,
    tRef,
    setSelectedConversationId,
    createConversation,
    setMessages,
    setInput,
    setLoadingMessages,
    setRegenerating,
    cancelStream,
    coreSend,
    waitForPartialMessageSaved,
  } = params;

  const resetChatUI = useCallback(() => {
    cancelStream(false);
    setMessages([]);
    setInput("");
  }, [cancelStream, setInput, setMessages]);

  const handleNewChat = useCallback(async () => {
    const conv = await createConversation?.();
    if (conv?.id) {
      setSelectedConversationId?.(conv.id);
      resetChatUI();
    }
  }, [createConversation, resetChatUI, setSelectedConversationId]);

  const handleSelectConversation = useCallback(
    async (id: string | null) => {
      cancelStream(false);
      setSelectedConversationId?.(id);
      setInput("");

      if (!id) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${id}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const json = await res.json();
        const data = json.data || json;
        setMessages(normalizeFrontendMessages(data?.messages));
      } catch (e: unknown) {
        logger.error("Failed to load messages:", e);
        toast.error(tRef.current("loadMessagesFailed"));
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [cancelStream, setInput, setLoadingMessages, setMessages, setSelectedConversationId, tRef]
  );

  useEffect(() => {
    if (!selectedConversationId || loadingMessages || isStreaming) return;
    if (prevConversationIdRef.current === selectedConversationId) return;
    if (messagesLength > 0 && prevConversationIdRef.current === selectedConversationId) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations?id=${selectedConversationId}`);
        if (!res.ok) throw new Error("Failed to load conversation");
        const json = await res.json();
        const data = json.data || json;
        setMessages(normalizeFrontendMessages(data?.messages));
      } catch (e: unknown) {
        logger.error("Auto-load messages failed:", e);
        toast.error(tRef.current("loadMessagesFailed"));
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    void loadMessages();
    prevConversationIdRef.current = selectedConversationId;
  }, [
    selectedConversationId,
    loadingMessages,
    isStreaming,
    messagesLength,
    prevConversationIdRef,
    setLoadingMessages,
    setMessages,
    tRef,
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
