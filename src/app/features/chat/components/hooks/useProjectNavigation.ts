// /app/features/chat/components/hooks/useProjectNavigation.ts
"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useProjectStore } from "@/lib/store/projectStore";
import type { FrontendConversation } from "../../hooks/useConversation";

interface UseProjectNavigationOptions {
  selectedProjectId: string | null;
  conversations: FrontendConversation[];
  setSelectedProjectId: Dispatch<SetStateAction<string | null>>;
  landingModel: string;
  createConversation: (options: {
    title: string;
    projectId: string;
    model: string;
  }) => Promise<FrontendConversation | null>;
  setSelectedConversationIdAndUrl: (id: string) => void;
  handleSelectConversation: (id: string | null) => Promise<void>;
  closeMobileSidebar: () => void;
}

/** Project view navigation: opening projects, creating/selecting project chats, settings modal. */
export function useProjectNavigation({
  selectedProjectId,
  conversations,
  setSelectedProjectId,
  landingModel,
  createConversation,
  setSelectedConversationIdAndUrl,
  handleSelectConversation,
  closeMobileSidebar,
}: UseProjectNavigationOptions) {
  const { projects } = useProjectStore();
  const selectedProject = useMemo(
    () => (selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null),
    [projects, selectedProjectId]
  );
  const projectConversations = useMemo(
    () => (selectedProjectId ? conversations.filter((c) => c.projectId === selectedProjectId) : []),
    [conversations, selectedProjectId]
  );

  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const openProjectSettings = useCallback(() => setShowProjectSettingsModal(true), []);
  const closeProjectSettings = useCallback(() => setShowProjectSettingsModal(false), []);

  /** Creates a chat inside a project and leaves the project view. */
  const createAndOpenProjectChat = useCallback(
    async (projectId: string, afterOpen?: () => void) => {
      const conv = await createConversation({ title: "", projectId, model: landingModel });
      if (conv) {
        setSelectedConversationIdAndUrl(conv.id);
        setSelectedProjectId(null);
        afterOpen?.();
      }
    },
    [createConversation, landingModel, setSelectedConversationIdAndUrl, setSelectedProjectId]
  );

  const createProjectChat = useCallback(
    (projectId: string) => createAndOpenProjectChat(projectId),
    [createAndOpenProjectChat]
  );

  const openProjectChat = useCallback(
    (id: string) => {
      void handleSelectConversation(id);
      setSelectedProjectId(null);
    },
    [handleSelectConversation, setSelectedProjectId]
  );

  // Sidebar variants also close the mobile drawer
  const memoizedOnCreateProjectChat = useCallback(
    (projectId: string) => createAndOpenProjectChat(projectId, closeMobileSidebar),
    [createAndOpenProjectChat, closeMobileSidebar]
  );

  const memoizedOnSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      void handleSelectConversation(null);
      closeMobileSidebar();
    },
    [setSelectedProjectId, handleSelectConversation, closeMobileSidebar]
  );

  return {
    selectedProjectId,
    selectedProject,
    projectConversations,
    showProjectSettingsModal,
    openProjectSettings,
    closeProjectSettings,
    createProjectChat,
    openProjectChat,
    memoizedOnCreateProjectChat,
    memoizedOnSelectProject,
  };
}
