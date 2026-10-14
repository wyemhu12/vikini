// /app/features/chat/components/hooks/useConversationSelectors.ts
"use client";

import { useMemo } from "react";
import { MODEL_IDS } from "@/lib/utils/constants";
import type { FrontendConversation, FrontendMessage } from "../../hooks/useConversation";

interface UseConversationSelectorsOptions {
  conversations: FrontendConversation[];
  personalConversations: FrontendConversation[];
  rawMessages: FrontendMessage[];
  selectedConversationId: string | null;
}

/** Memoized views over the conversation list for the current selection. */
export function useConversationSelectors({
  conversations,
  personalConversations,
  rawMessages,
  selectedConversationId,
}: UseConversationSelectorsOptions) {
  // Count prior messages that are stored in context for AI but hidden from UI
  const contextMessagesCount = useMemo(() => {
    const list = Array.isArray(rawMessages) ? rawMessages : [];
    return list.filter((m) =>
      Boolean((m.meta as Record<string, unknown> | undefined)?.isContextOnly)
    ).length;
  }, [rawMessages]);

  // Filter: only personal chats (no project) and exclude Image Studio & Novelcrafter
  const filteredConversations = useMemo(() => {
    return (personalConversations || []).filter(
      (c: FrontendConversation) =>
        c.model !== MODEL_IDS.IMAGE_STUDIO && c.model !== MODEL_IDS.NOVELCRAFTER
    );
  }, [personalConversations]);

  const currentConversation = useMemo(
    () =>
      (conversations || []).find(
        (c: FrontendConversation) =>
          c?.id === selectedConversationId &&
          c?.model !== MODEL_IDS.IMAGE_STUDIO &&
          c?.model !== MODEL_IDS.NOVELCRAFTER
      ),
    [conversations, selectedConversationId]
  );

  const parentConversation = useMemo(
    () =>
      currentConversation?.parentConversationId
        ? (conversations || []).find(
            (c: FrontendConversation) => c?.id === currentConversation.parentConversationId
          )
        : null,
    [conversations, currentConversation?.parentConversationId]
  );

  return { contextMessagesCount, filteredConversations, currentConversation, parentConversation };
}
