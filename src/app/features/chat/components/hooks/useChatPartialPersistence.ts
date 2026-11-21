"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { logger } from "@/lib/utils/logger";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";
import { mergeMessages } from "@/lib/features/chat/messageMerge";
import type { LocalStreamProgress, ThinkingStatsSnapshot } from "@/lib/features/chat/thinkingStats";
import {
  normalizeFrontendMessages,
  safeArray,
  type ChatFrontendMessage,
} from "@/lib/features/chat/streamProtocol";

export interface UseChatPartialPersistenceParams {
  selectedConversationId: string | null;
  messagesRef: MutableRefObject<ChatFrontendMessage[]>;
  streamingAssistantRef: MutableRefObject<string | null>;
  accumulatedAssistantRef: MutableRefObject<string>;
  accumulatedThinkingRef: MutableRefObject<string>;
  currentClientMessageIdRef: MutableRefObject<string | null>;
  localSourcesRef: MutableRefObject<unknown[]>;
  localRagSourcesRef: MutableRefObject<unknown[]>;
  localUrlContextRef: MutableRefObject<unknown[]>;
  emptyAnswerReasonRef: MutableRefObject<"length" | "no_content" | null>;
  thinkingStatsSnapshotRef: MutableRefObject<ThinkingStatsSnapshot | null>;
  setMessages: Dispatch<SetStateAction<ChatFrontendMessage[]>>;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  setStreamingAssistant: Dispatch<SetStateAction<string | null>>;
  setStreamingThinking: Dispatch<SetStateAction<string>>;
  setStreamingLocalProgress: Dispatch<SetStateAction<LocalStreamProgress | null>>;
  setStreamingSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingRagSources: Dispatch<SetStateAction<unknown[]>>;
  setStreamingUrlContext: Dispatch<SetStateAction<unknown[]>>;
  stopTypewriter: (flush?: boolean) => void;
  markAnswer: () => void;
}

export function useChatPartialPersistence(params: UseChatPartialPersistenceParams) {
  const {
    selectedConversationId,
    messagesRef,
    streamingAssistantRef,
    accumulatedAssistantRef,
    accumulatedThinkingRef,
    currentClientMessageIdRef,
    localSourcesRef,
    localRagSourcesRef,
    localUrlContextRef,
    emptyAnswerReasonRef,
    thinkingStatsSnapshotRef,
    setMessages,
    setIsStreaming,
    setStreamingAssistant,
    setStreamingThinking,
    setStreamingLocalProgress,
    setStreamingSources,
    setStreamingRagSources,
    setStreamingUrlContext,
    stopTypewriter,
    markAnswer,
  } = params;

  const syncPartialMessage = useCallback(
    async (convId: string, clientMsgId: string, content: string, meta: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            role: "assistant",
            content,
            clientMessageId: clientMsgId,
            meta,
          }),
        });
        if (!res.ok) throw new Error("Sync failed");

        const json = await res.json();
        const data = json.data;
        const savedMsg = data?.message;
        const alreadyComplete = Boolean(data?.alreadyComplete);

        setMessages((prev) =>
          prev.map((m) => {
            const metaObj = m.meta as Record<string, unknown> | undefined;
            if (metaObj?.clientMessageId === clientMsgId || m.id === `temp-${clientMsgId}`) {
              if (alreadyComplete && savedMsg) {
                return {
                  ...m,
                  id: savedMsg.id,
                  content: savedMsg.content,
                  meta: {
                    ...metaObj,
                    ...savedMsg.meta,
                    isPartial: false,
                    aborted: false,
                    isSaving: false,
                    saveFailed: false,
                  },
                };
              }
              return {
                ...m,
                id: savedMsg?.id || m.id,
                meta: { ...metaObj, isSaving: false, saveFailed: false },
              };
            }
            return m;
          })
        );
      } catch (syncErr: unknown) {
        logger.error("Failed to sync partial message:", syncErr);
        setMessages((prev) =>
          prev.map((m) => {
            const metaObj = m.meta as Record<string, unknown> | undefined;
            if (metaObj?.clientMessageId === clientMsgId || m.id === `temp-${clientMsgId}`) {
              return {
                ...m,
                meta: { ...metaObj, isSaving: false, saveFailed: true },
              };
            }
            return m;
          })
        );
      }
    },
    [setMessages]
  );

  const finalizeAssistantMessage = useCallback(
    (status: "aborted" | "error" | "complete", convId: string | null) => {
      stopTypewriter(true);
      markAnswer();
      setStreamingLocalProgress(null);

      const rawContent = accumulatedAssistantRef.current || streamingAssistantRef.current || "";
      const reasoning = accumulatedThinkingRef.current.trim();
      const trimmed = rawContent.trim();
      if (!trimmed && !reasoning) {
        setIsStreaming(false);
        setStreamingAssistant(null);
        setStreamingThinking("");
        setStreamingRagSources([]);
        return;
      }

      const balanced = balanceThinkTags(rawContent);
      const clientMsgId = currentClientMessageIdRef.current;
      const isPartial = status !== "complete";

      const meta: Record<string, unknown> = {
        ...(clientMsgId ? { clientMessageId: clientMsgId } : {}),
        ...(isPartial ? { isPartial: true, aborted: true, status, isSaving: true } : { status }),
        sources: safeArray(localSourcesRef.current),
        urlContext: safeArray(localUrlContextRef.current),
        ...(emptyAnswerReasonRef.current
          ? { emptyAnswerReason: emptyAnswerReasonRef.current }
          : {}),
        ...(reasoning ? { reasoning } : {}),
        ...(thinkingStatsSnapshotRef.current
          ? { thinkingStats: { ...thinkingStatsSnapshotRef.current, live: false } }
          : {}),
        ...(localRagSourcesRef.current.length > 0
          ? { ragSources: localRagSourcesRef.current }
          : {}),
      };

      const assistantMsg: ChatFrontendMessage = {
        role: "assistant",
        content: balanced,
        ...(isPartial && clientMsgId ? { id: `temp-${clientMsgId}` } : {}),
        sources: safeArray(localSourcesRef.current),
        urlContext: safeArray(localUrlContextRef.current),
        meta,
      };

      setMessages((prev) => [...normalizeFrontendMessages(prev), assistantMsg]);
      setIsStreaming(false);
      setStreamingAssistant(null);
      setStreamingThinking("");
      setStreamingSources([]);
      setStreamingRagSources([]);
      setStreamingUrlContext([]);

      if (isPartial && convId && clientMsgId) {
        void syncPartialMessage(convId, clientMsgId, balanced, meta);
      }
    },
    [
      accumulatedAssistantRef,
      accumulatedThinkingRef,
      currentClientMessageIdRef,
      emptyAnswerReasonRef,
      localRagSourcesRef,
      localSourcesRef,
      localUrlContextRef,
      markAnswer,
      setIsStreaming,
      setMessages,
      setStreamingAssistant,
      setStreamingLocalProgress,
      setStreamingRagSources,
      setStreamingSources,
      setStreamingThinking,
      setStreamingUrlContext,
      stopTypewriter,
      streamingAssistantRef,
      syncPartialMessage,
      thinkingStatsSnapshotRef,
    ]
  );

  const reloadMessagesAfterStream = useCallback(
    async (convId: string | null) => {
      if (!convId) return;
      try {
        const res = await fetch(`/api/conversations?id=${convId}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          if (data?.messages && Array.isArray(data.messages)) {
            setMessages((currentLocal) =>
              mergeMessages(normalizeFrontendMessages(data.messages), currentLocal)
            );
          }
        }
      } catch (reloadError: unknown) {
        logger.warn("Failed to reload messages after stream:", reloadError);
      }
    },
    [setMessages]
  );

  const retrySave = useCallback(
    async (msg: ChatFrontendMessage) => {
      const clientMsgId = (msg.meta as Record<string, unknown> | undefined)?.clientMessageId as
        | string
        | undefined;
      if (!selectedConversationId || !clientMsgId || !msg.content) return;

      setMessages((prev) =>
        prev.map((m) =>
          m === msg ||
          (clientMsgId &&
            (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId)
            ? {
                ...m,
                meta: {
                  ...(m.meta as Record<string, unknown> | undefined),
                  isSaving: true,
                  saveFailed: false,
                },
              }
            : m
        )
      );

      await syncPartialMessage(
        selectedConversationId,
        clientMsgId,
        msg.content,
        (msg.meta as Record<string, unknown>) || {}
      );
    },
    [selectedConversationId, setMessages, syncPartialMessage]
  );

  const waitForPartialMessageSaved = useCallback(
    async (lastMsg: ChatFrontendMessage): Promise<boolean> => {
      const lastMeta = lastMsg.meta as Record<string, unknown> | undefined;
      const clientMsgId = lastMeta?.clientMessageId as string | undefined;
      let isSaved = !lastMsg.id?.startsWith("temp-") && !lastMeta?.isSaving;

      if (clientMsgId && (lastMeta?.isSaving || lastMsg.id?.startsWith("temp-"))) {
        const startTime = Date.now();
        while (Date.now() - startTime < 8000) {
          const target = messagesRef.current.find(
            (m) =>
              (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId ||
              m.id === lastMsg.id
          );
          const targetMeta = target?.meta as Record<string, unknown> | undefined;
          if (
            target &&
            !targetMeta?.isSaving &&
            !targetMeta?.saveFailed &&
            !target.id?.startsWith("temp-")
          ) {
            isSaved = true;
            break;
          }
          if (targetMeta?.saveFailed) break;
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!isSaved && clientMsgId && selectedConversationId) {
        await syncPartialMessage(
          selectedConversationId,
          clientMsgId,
          lastMsg.content,
          lastMeta || {}
        );
        const fresh = messagesRef.current.find(
          (m) => (m.meta as Record<string, unknown> | undefined)?.clientMessageId === clientMsgId
        );
        const freshMeta = fresh?.meta as Record<string, unknown> | undefined;
        if (fresh && !freshMeta?.saveFailed && !fresh.id?.startsWith("temp-")) {
          isSaved = true;
        }
      }

      return isSaved;
    },
    [messagesRef, selectedConversationId, syncPartialMessage]
  );

  return {
    syncPartialMessage,
    finalizeAssistantMessage,
    reloadMessagesAfterStream,
    retrySave,
    waitForPartialMessageSaved,
  };
}
