// /app/features/chat/components/hooks/useConversationBranching.ts
"use client";

import { useCallback, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

interface BranchResponse {
  success?: boolean;
  error?: { message?: string };
  data?: { conversation?: { id?: string } };
}

interface UseConversationBranchingOptions {
  selectedConversationId: string | null;
  refreshConversations: () => Promise<void>;
  /** Called with the new conversation id once the branch is created. */
  onBranchCreated: (conversationId: string) => void;
  t: (key: string) => string;
}

export interface UseConversationBranchingReturn {
  branchingMessageId: string | null;
  handleBranchMessage: (messageId: string) => Promise<void>;
}

/** Branches the current conversation at a given message into a new conversation. */
export function useConversationBranching({
  selectedConversationId,
  refreshConversations,
  onBranchCreated,
  t,
}: UseConversationBranchingOptions): UseConversationBranchingReturn {
  const [branchingMessageId, setBranchingMessageId] = useState<string | null>(null);

  const handleBranchMessage = useCallback(
    async (messageId: string) => {
      if (!selectedConversationId) return;

      try {
        setBranchingMessageId(messageId);
        const res = await fetch(`/api/conversations/${selectedConversationId}/branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            titlePrefix: t("branchTitlePrefix") || "[Nhánh]",
          }),
        });

        const json = (await res.json()) as BranchResponse;
        if (!res.ok || !json.success) {
          throw new Error(
            json.error?.message || t("branchFailed") || "Failed to branch conversation"
          );
        }

        const newConvo = json.data?.conversation;
        if (newConvo?.id) {
          toast.success(t("branchSuccess") || "Đã tách cuộc trò chuyện thành công");
          await refreshConversations();
          onBranchCreated(newConvo.id);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : t("branchFailed") || "Failed to branch conversation";
        logger.error("[ChatApp] Branch conversation error:", msg);
        toast.error(msg);
      } finally {
        setBranchingMessageId(null);
      }
    },
    [selectedConversationId, refreshConversations, onBranchCreated, t]
  );

  return { branchingMessageId, handleBranchMessage };
}
