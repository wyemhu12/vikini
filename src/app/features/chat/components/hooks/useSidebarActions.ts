// /app/features/chat/components/hooks/useSidebarActions.ts
"use client";

import { useCallback } from "react";
import { signOut } from "next-auth/react";

interface UseSidebarActionsOptions {
  handleSelectConversation: (id: string | null) => Promise<void>;
  handleNewChat: () => Promise<void>;
  openRenameModal: (id: string, currentTitle: string) => void;
  closeMobileSidebar: () => void;
}

/** Stable sidebar callbacks (keeps React.memo(Sidebar) effective). */
export function useSidebarActions({
  handleSelectConversation,
  handleNewChat,
  openRenameModal,
  closeMobileSidebar,
}: UseSidebarActionsOptions) {
  const onSelectConversation = useCallback(
    (id: string | null) => {
      void handleSelectConversation(id);
      closeMobileSidebar();
    },
    [handleSelectConversation, closeMobileSidebar]
  );

  const onNewChat = useCallback(() => {
    void handleNewChat();
    closeMobileSidebar();
  }, [handleNewChat, closeMobileSidebar]);

  const onRenameChat = useCallback((id: string) => openRenameModal(id, ""), [openRenameModal]);

  const onLogout = useCallback(() => signOut(), []);

  return { onSelectConversation, onNewChat, onRenameChat, onLogout };
}
