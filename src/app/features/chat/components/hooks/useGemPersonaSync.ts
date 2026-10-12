// /app/features/chat/components/hooks/useGemPersonaSync.ts
"use client";

import { useEffect } from "react";
import { useGemStore } from "../../../gems/stores/useGemStore";
import { usePersonaStore } from "../../../personas/stores/usePersonaStore";

/** Gem / persona info attached to a conversation */
interface AttachmentInfo {
  name: string;
  icon: string | null;
  color: string | null;
}

interface UseGemPersonaSyncOptions {
  patchConversationGem: (id: string, gem: AttachmentInfo | null) => void;
  patchConversationPersona: (id: string, persona: AttachmentInfo | null) => void;
  refreshConversations: () => Promise<void>;
}

/** Keeps the conversation list in sync when a gem or persona is applied from its modal. */
export function useGemPersonaSync({
  patchConversationGem,
  patchConversationPersona,
  refreshConversations,
}: UseGemPersonaSyncOptions): void {
  const { setOnGemApplied } = useGemStore();
  useEffect(() => {
    setOnGemApplied((conversationId: string, gem: AttachmentInfo | null) => {
      patchConversationGem(conversationId, gem);
      void refreshConversations();
    });
    return () => {
      if (useGemStore.getState().setOnGemApplied) {
        useGemStore.getState().setOnGemApplied(null);
      }
    };
  }, [setOnGemApplied, patchConversationGem, refreshConversations]);

  const { setOnPersonaApplied } = usePersonaStore();
  useEffect(() => {
    setOnPersonaApplied((conversationId: string, persona: AttachmentInfo | null) => {
      patchConversationPersona(conversationId, persona);
      void refreshConversations();
    });
    return () => {
      if (usePersonaStore.getState().setOnPersonaApplied) {
        usePersonaStore.getState().setOnPersonaApplied(null);
      }
    };
  }, [setOnPersonaApplied, patchConversationPersona, refreshConversations]);
}
