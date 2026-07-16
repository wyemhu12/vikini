"use client";

// Chat modals section — extracted from ChatApp.tsx
// Contains Rename, Delete Message, Project Settings, and Image Edit modals

import React, { lazy, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectSettingsModal } from "@/components/features/projects/ProjectSettingsModal";

const EditImagePromptModal = lazy(() => import("@/app/components/EditImagePromptModal"));

interface ChatModalsSectionProps {
  // Rename Modal
  showRenameModal: boolean;
  closeRenameModal: () => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  confirmRename: () => void;

  // Delete Message Modal
  showDeleteMessageModal: boolean;
  closeDeleteMessageModal: () => void;
  confirmDeleteMessage: () => void;

  // Image Edit Modal
  showEditImageModal: boolean;
  closeEditImageModal: () => void;
  editingImagePrompt: string;
  confirmImageEdit: (prompt: string) => void;

  // Project Settings Modal
  selectedProjectId: string | null;
  showProjectSettingsModal: boolean;
  closeProjectSettingsModal: () => void;
  onCreateProjectChat: (projectId: string) => Promise<void>;
  onSelectChat: (chatId: string) => void;

  // Translations
  t: Record<string, string>;
}

export default function ChatModalsSection({
  showRenameModal,
  closeRenameModal,
  renameValue,
  setRenameValue,
  confirmRename,
  showDeleteMessageModal,
  closeDeleteMessageModal,
  confirmDeleteMessage,
  showEditImageModal,
  closeEditImageModal,
  editingImagePrompt,
  confirmImageEdit,
  selectedProjectId,
  showProjectSettingsModal,
  closeProjectSettingsModal,
  onCreateProjectChat,
  onSelectChat,
  t,
}: ChatModalsSectionProps) {
  return (
    <>
      <Suspense fallback={null}>
        <EditImagePromptModal
          isOpen={showEditImageModal}
          onClose={closeEditImageModal}
          initialPrompt={editingImagePrompt}
          onConfirm={confirmImageEdit}
        />
      </Suspense>

      {/* Rename Modal */}
      <Dialog open={showRenameModal} onOpenChange={(open) => !open && closeRenameModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.renameChat || "Rename Conversation"}</DialogTitle>
          </DialogHeader>
          <Input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmRename()}
            autoFocus
            className="h-11"
            placeholder={t.renameChat || "Enter new title"}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeRenameModal}>
              {t.cancel || "Cancel"}
            </Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim()}>
              {t.save || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Message Modal */}
      <Dialog
        open={showDeleteMessageModal}
        onOpenChange={(open) => !open && closeDeleteMessageModal()}
      >
        <DialogContent className="max-w-md ring-(--danger)/20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px -z-10 rounded-(--radius) bg-(--danger)/15 blur-2xl"
          />
          <DialogHeader>
            <DialogTitle>{t.modalDeleteTitle || "Delete Message?"}</DialogTitle>
            <DialogDescription className="pt-1">
              {t.modalDeleteConfirm ||
                "Are you sure you want to delete this message? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeDeleteMessageModal}>
              {t.cancel || "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteMessage}>
              {t.modalDeleteButton || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Settings Modal */}
      {selectedProjectId && (
        <ProjectSettingsModal
          projectId={selectedProjectId}
          isOpen={showProjectSettingsModal}
          onClose={closeProjectSettingsModal}
          onNewChat={onCreateProjectChat}
          onSelectChat={onSelectChat}
        />
      )}
    </>
  );
}
