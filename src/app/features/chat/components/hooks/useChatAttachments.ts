// /app/features/chat/components/hooks/useChatAttachments.ts
"use client";

import { useEffect, useMemo, useRef } from "react";
import { createDraftCoordinator } from "@/lib/features/chat/draftConversation";
import { useFiles } from "@/lib/features/files/useFiles";
import type { FrontendConversation, FrontendMessage } from "../../hooks/useConversation";

interface UseChatAttachmentsOptions {
  selectedConversationId: string | null;
  renderedMessages: FrontendMessage[];
  landingModel: string;
  createConversation: (options: { model: string }) => Promise<FrontendConversation | null>;
  setSelectedConversationIdAndUrl: (id: string) => void;
}

/** File upload wiring: draft conversation creation for New Chat uploads and file bookkeeping. */
export function useChatAttachments({
  selectedConversationId,
  renderedMessages,
  landingModel,
  createConversation,
  setSelectedConversationIdAndUrl,
}: UseChatAttachmentsOptions) {
  // Draft conversation coordinator for New Chat file uploads
  const isSelfInitiatedUploadRef = useRef(false);
  const draftCoordinator = useMemo(
    () =>
      createDraftCoordinator({
        createConversation: async () => {
          const conv = await createConversation({ model: landingModel });
          if (conv) {
            setSelectedConversationIdAndUrl(conv.id);
            return { id: conv.id };
          }
          return null;
        },
      }),
    [createConversation, landingModel, setSelectedConversationIdAndUrl]
  );

  useEffect(() => {
    draftCoordinator.reset();
  }, [selectedConversationId, draftCoordinator]);

  // File count for file manager button
  const { fileCount } = useFiles(selectedConversationId);

  // Compute which files have already been sent in messages (survives reload)
  const sentMessageFileIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of renderedMessages) {
      if (m.role === "user" && m.meta) {
        const meta = m.meta as Record<string, unknown>;
        const fIds = meta["fileIds"];
        if (Array.isArray(fIds)) {
          ids.push(...(fIds as string[]));
        }
      }
    }
    return ids;
  }, [renderedMessages]);

  return {
    ensureConversationId: draftCoordinator.ensureConversationId,
    isSelfInitiatedUploadRef,
    fileCount,
    sentMessageFileIds,
  };
}
