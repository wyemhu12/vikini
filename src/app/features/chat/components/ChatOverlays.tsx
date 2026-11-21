// /app/features/chat/components/ChatOverlays.tsx
"use client";

import React, { lazy, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import ChatModalsSection from "./ChatModalsSection";
import { useLanguage } from "../hooks/useLanguage";
import { buildNavigationCommands } from "../../layout/utils/navigationCommands";
import type { UseChatShortcutsReturn } from "./hooks/useChatShortcuts";
import type { UseChatModalsReturn } from "./hooks/useChatModals";
import type { useImageGenController } from "./hooks/useImageGenController";
import type { useProjectNavigation } from "./hooks/useProjectNavigation";

const UpgradeModal = lazy(() => import("@/app/components/UpgradeModal"));
const CommandPalette = lazy(() => import("./CommandPalette"));
const KeyboardShortcutsModal = lazy(() => import("./KeyboardShortcutsModal"));

interface ChatOverlaysProps {
  modals: UseChatModalsReturn;
  imageGen: ReturnType<typeof useImageGenController>;
  projectNav: ReturnType<typeof useProjectNavigation>;
  shortcuts: UseChatShortcutsReturn;
  conversations: Array<{ id: string; title?: string }>;
  onNewChat: () => Promise<void>;
  /** Command palette selection (loads the conversation). */
  onSelectConversation: (id: string | null) => Promise<void>;
}

/**
 * Overlay layer of the chat shell: upgrade modal,
 * chat modals, command palette and keyboard shortcuts (lazy-loaded).
 */
export default function ChatOverlays({
  modals,
  imageGen,
  projectNav,
  shortcuts,
  conversations,
  onNewChat,
  onSelectConversation,
}: ChatOverlaysProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { closeCommandPalette } = shortcuts;

  const navCommands = useMemo(
    () =>
      buildNavigationCommands({
        t,
        onNavigate: (href) => {
          closeCommandPalette();
          router.push(href);
        },
      }),
    [t, router, closeCommandPalette]
  );

  return (
    <>
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={modals.showUpgradeModal}
          onClose={modals.closeUpgradeModal}
          modelName={modals.restrictedModel || ""}
        />
      </Suspense>

      <ChatModalsSection
        showRenameModal={modals.showRenameModal}
        closeRenameModal={modals.closeRenameModal}
        renameValue={modals.renameValue}
        setRenameValue={modals.setRenameValue}
        confirmRename={modals.confirmRename}
        showDeleteMessageModal={modals.showDeleteMessageModal}
        closeDeleteMessageModal={modals.closeDeleteMessageModal}
        confirmDeleteMessage={modals.confirmDeleteMessage}
        showEditImageModal={imageGen.showEditImageModal}
        closeEditImageModal={() => imageGen.setShowEditImageModal(false)}
        editingImagePrompt={imageGen.editingImagePrompt}
        confirmImageEdit={imageGen.confirmImageEdit}
        selectedProjectId={projectNav.selectedProjectId}
        showProjectSettingsModal={projectNav.showProjectSettingsModal}
        closeProjectSettingsModal={projectNav.closeProjectSettings}
        onCreateProjectChat={projectNav.createProjectChat}
        onSelectChat={projectNav.openProjectChat}
      />

      {/* Command Palette */}
      {shortcuts.isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={shortcuts.isCommandPaletteOpen}
            onClose={shortcuts.closeCommandPalette}
            onNewChat={() => void onNewChat()}
            onOpenShortcuts={shortcuts.openShortcutsModal}
            extraCommands={navCommands}
            onSelectConversation={(id) => void onSelectConversation(id)}
            conversations={conversations}
          />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Modal */}
      {shortcuts.isShortcutsModalOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal
            isOpen={shortcuts.isShortcutsModalOpen}
            onClose={shortcuts.closeShortcutsModal}
          />
        </Suspense>
      )}
    </>
  );
}
