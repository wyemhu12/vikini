// /app/features/chat/components/hooks/useResearchAwareSend.ts
"use client";

import { useCallback } from "react";
import { toast } from "@/lib/store/toastStore";

interface UseResearchAwareSendOptions {
  input: string;
  setInput: (value: string) => void;
  handleSend: (text?: string, fileIds?: string[]) => void;
  isDeepResearchMode: boolean;
  startResearch: (
    query: string,
    conversationId?: string,
    projectId?: string,
    gemId?: string
  ) => Promise<void>;
  selectedConversationId: string | null;
  selectedProjectId: string | null;
  gemId: string | undefined;
}

/** Send handler that routes the query to Deep Research when that mode is active. */
export function useResearchAwareSend({
  input,
  setInput,
  handleSend,
  isDeepResearchMode,
  startResearch,
  selectedConversationId,
  selectedProjectId,
  gemId,
}: UseResearchAwareSendOptions) {
  return useCallback(
    (text?: string, fileIds?: string[]) => {
      const finalQuery = text || input;
      if (isDeepResearchMode) {
        if (finalQuery.trim()) {
          setInput("");
          startResearch(
            finalQuery,
            selectedConversationId || undefined,
            selectedProjectId || undefined,
            gemId || undefined
          ).catch((e: unknown) =>
            toast.error((e instanceof Error && e.message) || "Failed to start research")
          );
        }
      } else {
        handleSend(text, fileIds);
      }
    },
    [
      isDeepResearchMode,
      startResearch,
      handleSend,
      selectedConversationId,
      selectedProjectId,
      gemId,
      input,
      setInput,
    ]
  );
}
