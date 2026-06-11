// /app/features/chat/components/hooks/useChatModals.ts
"use client";

import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { logger } from "@/lib/utils/logger";
import type { FrontendConversation, FrontendMessage } from "../../hooks/useConversation";

// ============================================
// Type Definitions
// ============================================

export interface UseChatModalsReturn {
  // Upgrade Modal
  showUpgradeModal: boolean;
  restrictedModel: string | null;
  openUpgradeModal: (modelName: string) => void;
  closeUpgradeModal: () => void;

  // Delete Conversation (imperative confirm)
  openDeleteModal: (id: string) => void;

  // Rename Modal
  showRenameModal: boolean;
  renameConversationId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  openRenameModal: (id: string, currentTitle: string) => void;
  closeRenameModal: () => void;
  confirmRename: () => Promise<void>;

  // Delete Message Modal
  showDeleteMessageModal: boolean;
  messageToDelete: string | null;
  openDeleteMessageModal: (messageId: string) => void;
  closeDeleteMessageModal: () => void;
  confirmDeleteMessage: () => Promise<void>;
}

interface UseChatModalsOptions {
  conversations: FrontendConversation[];
  selectedConversationId: string | null;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  renameConversationOptimistic: (id: string, title: string) => void;
  refreshConversations: () => Promise<void>;
  resetChatUI: () => void;
  setMessages: Dispatch<SetStateAction<FrontendMessage[]>>;
  t: Record<string, string>;
}

// ============================================
// Hook Implementation
// ============================================

export function useChatModals({
  conversations,
  selectedConversationId,
  deleteConversation,
  renameConversation,
  renameConversationOptimistic,
  refreshConversations,
  resetChatUI,
  setMessages,
  t,
}: UseChatModalsOptions): UseChatModalsReturn {
  // ============================================
  // Upgrade Modal State
  // ============================================
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restrictedModel, setRestrictedModel] = useState<string | null>(null);

  const openUpgradeModal = useCallback((modelName: string) => {
    setRestrictedModel(modelName);
    setShowUpgradeModal(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  // ============================================
  // Delete Conversation (imperative confirm)
  // ============================================
  const openDeleteModal = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t.modalDeleteTitle || "Delete Conversation",
        description: t.modalDeleteConfirm || "Are you sure you want to delete this conversation?",
        variant: "danger",
        confirmLabel: t.modalDeleteButton || "Delete",
        cancelLabel: t.cancel || "Cancel",
      });
      if (!ok) return;
      try {
        await deleteConversation(id);
        if (id === selectedConversationId) {
          resetChatUI();
        }
        await refreshConversations();
      } catch (error) {
        logger.error("Failed to delete conversation:", error);
        toast.error(t.error);
      }
    },
    [
      deleteConversation,
      refreshConversations,
      resetChatUI,
      selectedConversationId,
      t.modalDeleteTitle,
      t.modalDeleteConfirm,
      t.modalDeleteButton,
      t.cancel,
      t.error,
    ]
  );

  // ============================================
  // Rename Modal State
  // ============================================
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const openRenameModal = useCallback(
    (id: string, currentTitle: string) => {
      const current = (conversations || []).find((c) => c?.id === id);
      setRenameConversationId(id);
      setRenameValue(current?.title || currentTitle || "");
      setShowRenameModal(true);
    },
    [conversations]
  );

  const closeRenameModal = useCallback(() => {
    setShowRenameModal(false);
    setRenameConversationId(null);
    setRenameValue("");
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renameConversationId || !renameValue.trim()) return;
    try {
      renameConversationOptimistic(renameConversationId, renameValue.trim());
      await renameConversation(renameConversationId, renameValue.trim());
      toast.success(t.success || "Renamed successfully");
    } catch (error) {
      logger.error("Failed to rename:", error);
      toast.error(t.error);
    } finally {
      setShowRenameModal(false);
      setRenameConversationId(null);
      setRenameValue("");
    }
  }, [
    renameConversationId,
    renameValue,
    renameConversation,
    renameConversationOptimistic,
    t.success,
    t.error,
  ]);

  // ============================================
  // Delete Message Modal State
  // ============================================
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const openDeleteMessageModal = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteMessageModal(true);
  }, []);

  const closeDeleteMessageModal = useCallback(() => {
    setShowDeleteMessageModal(false);
    setMessageToDelete(null);
  }, []);

  const confirmDeleteMessage = useCallback(async () => {
    if (!messageToDelete) return;
    try {
      setMessages((prev) => prev.filter((m) => m.id !== messageToDelete));
      const res = await fetch(`/api/messages/${messageToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete message");
      toast.success(t.success || "Message deleted");
    } catch (e) {
      logger.error("Delete message error:", e);
      toast.error(t.error);
    } finally {
      setShowDeleteMessageModal(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, t.success, t.error, setMessages]);

  // ============================================
  // Return
  // ============================================
  return {
    // Upgrade Modal
    showUpgradeModal,
    restrictedModel,
    openUpgradeModal,
    closeUpgradeModal,

    // Delete Conversation (imperative)
    openDeleteModal,

    // Rename Modal
    showRenameModal,
    renameConversationId,
    renameValue,
    setRenameValue,
    openRenameModal,
    closeRenameModal,
    confirmRename,

    // Delete Message Modal
    showDeleteMessageModal,
    messageToDelete,
    openDeleteMessageModal,
    closeDeleteMessageModal,
    confirmDeleteMessage,
  };
}
