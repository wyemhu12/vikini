"use client";

import { useCallback } from "react";
import { logger } from "@/lib/utils/logger";
import { balanceThinkTags } from "@/lib/features/chat/thinkTags";
import { mergeMessages } from "@/lib/features/chat/messageMerge";
import {
  countContextOnlyMessages,
  normalizeFrontendMessages,
  safeArray,
  type ChatFrontendMessage,
} from "@/lib/features/chat/streamProtocol";
import type { UseChatPartialPersistenceParams } from "./chatStreamHookTypes";

export type { UseChatPartialPersistenceParams };

export function useChatPartialPersistence(params: UseChatPartialPersistenceParams) {
  const {
    selectedConversationId,
    activeConvIdRef,
    isUnmountedRef,
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
    setContextMessagesCount,
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
        if (isUnmountedRef.current || activeConvIdRef.current !== convId) return;

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
        if (isUnmountedRef.current || activeConvIdRef.current !== convId) return;
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
    [activeConvIdRef, isUnmountedRef, setMessages]
  );

  const finalizeAssistantMessage = useCallback(
    (status: "aborted" | "error" | "complete", convId: string | null): Promise<void> => {
      stopTypewriter(true);
      markAnswer();
      if (isUnmountedRef.current) return Promise.resolve();
      setStreamingLocalProgress(null);

      const rawContent = accumulatedAssistantRef.current || streamingAssistantRef.current || "";
      const reasoning = accumulatedThinkingRef.current.trim();
      const trimmed = rawContent.trim();
      if (!trimmed && !reasoning) {
        setIsStreaming(false);
        setStreamingAssistant(null);
        setStreamingThinking("");
        setStreamingRagSources([]);
        return Promise.resolve();
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

      if (!convId || activeConvIdRef.current === convId) {
        setMessages((prev) => [...normalizeFrontendMessages(prev), assistantMsg]);
      }
      setIsStreaming(false);
      setStreamingAssistant(null);
      setStreamingThinking("");
      setStreamingSources([]);
      setStreamingRagSources([]);
      setStreamingUrlContext([]);

      if (isPartial && convId && clientMsgId) {
        return syncPartialMessage(convId, clientMsgId, balanced, meta);
      }
      return Promise.resolve();
    },
    [
      accumulatedAssistantRef,
      accumulatedThinkingRef,
      activeConvIdRef,
      currentClientMessageIdRef,
      emptyAnswerReasonRef,
      isUnmountedRef,
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
      if (!convId || isUnmountedRef.current || activeConvIdRef.current !== convId) return;
      try {
        const res = await fetch(`/api/conversations?id=${encodeURIComponent(convId)}`, {
          cache: "no-store",
        });
        if (!res.ok || isUnmountedRef.current || activeConvIdRef.current !== convId) return;
        const json = await res.json();
        if (isUnmountedRef.current || activeConvIdRef.current !== convId) return;
        const data = json.data || json;
        if (data?.messages && Array.isArray(data.messages)) {
          setContextMessagesCount(countContextOnlyMessages(data.messages));
          setMessages((currentLocal) =>
            mergeMessages(normalizeFrontendMessages(data.messages), currentLocal)
          );
        }
      } catch (reloadError: unknown) {
        logger.warn("Failed to reload messages after stream:", reloadError);
      }
    },
    [activeConvIdRef, isUnmountedRef, setContextMessagesCount, setMessages]
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
