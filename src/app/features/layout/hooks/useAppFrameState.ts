"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConversation, type FrontendConversation } from "../../chat/hooks/useConversation";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useLayoutStore } from "@/lib/store/layoutStore";
import { confirm } from "@/lib/store/confirmStore";
import { getSectionForPath } from "../utils/shellNav";

/** Conversation models that are storage containers, not chats shown in the sidebar. */
const NON_CHAT_MODELS: ReadonlySet<string> = new Set([
  "vikini-image-studio",
  "user_templates_store",
  "vikini-novelcrafter",
]);

/** Sidebar data, actions, and drawer state for AppFrame pages. */
export function useAppFrameState() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    conversations,
    createConversation,
    renameConversation,
    renameConversationOptimistic,
    deleteConversation,
  } = useConversation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const section = getSectionForPath(usePathname());
  const sidebarCollapsed = useLayoutStore((s) => s.panelCollapsedBySection[section]);
  const togglePanel = useLayoutStore((s) => s.togglePanel);

  const allConversations: FrontendConversation[] = useMemo(
    () => conversations || [],
    [conversations]
  );
  const mainChats = useMemo(
    () => allConversations.filter((c) => !c.projectId && !NON_CHAT_MODELS.has(c.model ?? "")),
    [allConversations]
  );
  const studioProjects = useMemo(
    () => allConversations.filter((c) => c.model === "vikini-image-studio"),
    [allConversations]
  );

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => togglePanel(section), [togglePanel, section]);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      closeMobile();
      router.push(`/projects/${projectId}`);
    },
    [closeMobile, router]
  );

  const handleCreateProjectChat = useCallback(
    async (projectId: string) => {
      const conv = await createConversation({ title: "", projectId });
      if (!conv) return;
      closeMobile();
      router.push(`/?id=${conv.id}`);
    },
    [createConversation, closeMobile, router]
  );

  const handleCreateStudioProject = useCallback(async () => {
    const conv = await createConversation({
      title: t("studioNewProject"),
      model: "vikini-image-studio",
    });
    if (!conv) return;
    closeMobile();
    router.push(`/images?projectId=${conv.id}`);
  }, [createConversation, t, closeMobile, router]);

  const openRenameChat = useCallback(
    (id: string) => {
      const target = allConversations.find((c) => c.id === id);
      setRenamingChatId(id);
      setRenameValue(target?.title || "");
    },
    [allConversations]
  );

  const closeRenameChat = useCallback(() => {
    setRenamingChatId(null);
    setRenameValue("");
  }, []);

  const confirmRenameChat = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!renamingChatId || !trimmed) return;
    const targetId = renamingChatId;
    closeRenameChat();
    renameConversationOptimistic(targetId, trimmed);
    // useConversation.renameConversation already mutates SWR & fires toast feedback
    await renameConversation(targetId, trimmed);
  }, [
    renameValue,
    renamingChatId,
    closeRenameChat,
    renameConversationOptimistic,
    renameConversation,
  ]);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t("deleteConversationQuestion"),
        description: t("modalDeleteConfirm"),
        variant: "danger",
        confirmLabel: t("modalDeleteButton"),
      });
      if (!ok) return;
      // useConversation.deleteConversation already mutates SWR & fires toast feedback
      await deleteConversation(id);
    },
    [deleteConversation, t]
  );

  return {
    section,
    allConversations,
    mainChats,
    studioProjects,
    mobileOpen,
    sidebarCollapsed,
    openMobile,
    closeMobile,
    toggleCollapsed,
    handleSelectProject,
    handleCreateProjectChat,
    handleCreateStudioProject,
    handleDeleteChat,
    renamingChatId,
    renameValue,
    setRenameValue,
    openRenameChat,
    closeRenameChat,
    confirmRenameChat,
  };
}
