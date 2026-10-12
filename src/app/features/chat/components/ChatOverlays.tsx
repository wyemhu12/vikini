// /app/features/chat/components/ChatOverlays.tsx
"use client";

import React, { lazy, Suspense } from "react";
import { toast } from "@/lib/store/toastStore";
import ChatModalsSection from "./ChatModalsSection";
import type { UseDeepResearchModeReturn } from "./hooks/useDeepResearchMode";
import type { UseChatShortcutsReturn } from "./hooks/useChatShortcuts";
import type { UseChatModalsReturn } from "./hooks/useChatModals";
import type { useImageGenController } from "./hooks/useImageGenController";
import type { useProjectNavigation } from "./hooks/useProjectNavigation";

const UpgradeModal = lazy(() => import("@/app/components/UpgradeModal"));
const ResearchReportPanel = lazy(() => import("../../research/components/ResearchReportPanel"));
const ResearchThinkingPanel = lazy(() => import("../../research/components/ResearchThinkingPanel"));
const EditPlanModal = lazy(() => import("../../research/components/EditPlanModal"));
const CommandPalette = lazy(() => import("./CommandPalette"));
const KeyboardShortcutsModal = lazy(() => import("./KeyboardShortcutsModal"));

interface ChatOverlaysProps {
  modals: UseChatModalsReturn;
  imageGen: ReturnType<typeof useImageGenController>;
  projectNav: ReturnType<typeof useProjectNavigation>;
  research: UseDeepResearchModeReturn;
  isEditPlanOpen: boolean;
  closeEditPlan: () => void;
  shortcuts: UseChatShortcutsReturn;
  conversations: Array<{ id: string; title?: string }>;
  onNewChat: () => Promise<void>;
  /** Command palette selection (loads the conversation). */
  onSelectConversation: (id: string | null) => Promise<void>;
  /** Opens the conversation linked to a finished research report (URL navigation). */
  onOpenResearchConversation: (id: string) => void;
  t: Record<string, string>;
}

/**
 * Overlay layer of the chat shell: upgrade modal, deep research panels,
 * chat modals, command palette and keyboard shortcuts (lazy-loaded).
 */
export default function ChatOverlays({
  modals,
  imageGen,
  projectNav,
  research,
  isEditPlanOpen,
  closeEditPlan,
  shortcuts,
  conversations,
  onNewChat,
  onSelectConversation,
  onOpenResearchConversation,
  t,
}: ChatOverlaysProps) {
  const { isDeepResearchMode, currentTask, isReportPanelOpen, isThinkingPanelOpen } = research;

  return (
    <>
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={modals.showUpgradeModal}
          onClose={modals.closeUpgradeModal}
          modelName={modals.restrictedModel || ""}
        />
      </Suspense>

      {/* Deep Research Report Panel */}
      {isDeepResearchMode && isReportPanelOpen && currentTask && currentTask.reportText && (
        <Suspense fallback={null}>
          <ResearchReportPanel
            title={currentTask.query}
            report={currentTask.reportText}
            sources={currentTask.sources}
            isOpen={isReportPanelOpen}
            onClose={research.closeReportPanel}
            onOpenThoughts={() => {
              // Only open thoughts if there is thinking data
              if (currentTask.thinkingText) {
                research.openThinkingPanel();
              }
            }}
            onCreateConversation={
              currentTask.conversationId
                ? () => {
                    research.closeReportPanel();
                    research.exitDeepResearch();
                    if (currentTask.conversationId) {
                      onOpenResearchConversation(currentTask.conversationId);
                    }
                  }
                : undefined
            }
          />
        </Suspense>
      )}

      {/* Deep Research Thinking Panel */}
      {isDeepResearchMode && isThinkingPanelOpen && currentTask && (
        <Suspense fallback={null}>
          <ResearchThinkingPanel
            title={currentTask.query}
            isOpen={isThinkingPanelOpen}
            onClose={research.closeThinkingPanel}
            thinkingText={currentTask.thinkingText}
            sources={currentTask.searchedSources}
            isCompleted={currentTask.status === "completed" || currentTask.status === "failed"}
          />
        </Suspense>
      )}

      {/* Edit Plan Modal - replaces window.prompt() */}
      {isDeepResearchMode && isEditPlanOpen && (
        <Suspense fallback={null}>
          <EditPlanModal
            isOpen={isEditPlanOpen}
            onClose={closeEditPlan}
            onSubmit={(feedback) => {
              research
                .approvePlan(feedback)
                .catch((e: unknown) =>
                  toast.error(e instanceof Error ? e.message : "Failed to revise plan")
                );
            }}
          />
        </Suspense>
      )}

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
        t={t}
      />

      {/* Command Palette */}
      {shortcuts.isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={shortcuts.isCommandPaletteOpen}
            onClose={shortcuts.closeCommandPalette}
            onNewChat={() => void onNewChat()}
            onOpenShortcuts={shortcuts.openShortcutsModal}
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
