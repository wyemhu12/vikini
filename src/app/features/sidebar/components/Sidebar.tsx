// /app/features/sidebar/components/Sidebar.tsx
// App shell composition: desktop icon rail + context panel, mobile drawer.
"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Image as ImageIcon, LayoutGrid, Search } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/lib/store/toastStore";
import { CreateProjectModal } from "@/components/features/projects";
import { useProjectStore } from "@/lib/store/projectStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { FrontendConversation } from "../../chat/hooks/useConversation";
import { getSectionForPath } from "../../layout/utils/shellNav";
import AppRail from "./AppRail";
import MobileNavDrawer from "./MobileNavDrawer";
import ContextPanelContent, { type PanelConversation, type PanelLink } from "./ContextPanelContent";
import type { RailSessionUser } from "./RailMenus";

interface SidebarProps {
  conversations?: PanelConversation[];
  selectedConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onDeleteAll?: () => void;
  onRefresh?: () => Promise<void> | void;
  chats?: PanelConversation[];
  activeId?: string | null;
  onSelectChat?: (id: string) => void;
  onRenameChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  /** Rail "new chat" button — always starts a chat. */
  onNewChat?: () => void;
  /** Section-specific primary action shown at the top of the context panel. */
  sectionActionLabel?: string;
  onSectionAction?: () => void;
  conversationsLabel?: string;
  onLogout?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  session?: { user?: RailSessionUser & { image?: string | null; id?: string } } | null;
  /** Context panel hidden (rail stays). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommandPalette?: () => void;
  onLogoClick?: () => void;
  allConversations?: FrontendConversation[];
  onCreateProjectChat?: (projectId: string) => Promise<void>;
  onSelectProject?: (projectId: string) => void;
  onRenameProjectConversation?: (id: string) => void;
  onDeleteProjectConversation?: (id: string) => void;
  isCreatingChat?: boolean;
}

function Sidebar(props: SidebarProps) {
  const {
    conversations,
    chats,
    mobileOpen = false,
    onCloseMobile,
    collapsed = false,
    allConversations = [],
    isCreatingChat = false,
  } = props;
  const {
    onSelectChat,
    onSelectConversation,
    onRenameChat,
    onDeleteChat,
    onDeleteConversation,
    onNewChat,
  } = props;
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const section = getSectionForPath(pathname);
  const { projects, fetchProjects } = useProjectStore();
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const list = Array.isArray(chats) ? chats : Array.isArray(conversations) ? conversations : [];
  const currentId = props.activeId ?? props.selectedConversationId ?? null;

  const handleSelect = React.useCallback(
    (id: string) => {
      (onSelectChat ?? onSelectConversation)?.(id);
      onCloseMobile?.();
    },
    [onSelectChat, onSelectConversation, onCloseMobile]
  );

  const handleNewChat = React.useCallback(() => {
    if (isCreatingChat) return;
    onNewChat?.();
    onCloseMobile?.();
  }, [isCreatingChat, onNewChat, onCloseMobile]);

  const handleRename = React.useCallback(
    (id: string) => {
      if (typeof onRenameChat === "function") onRenameChat(id);
      else toast.info(t("renameFallbackToast"));
    },
    [onRenameChat, t]
  );

  const handleDelete = React.useCallback(
    (id: string) => {
      const fn = onDeleteChat ?? onDeleteConversation;
      if (typeof fn !== "function") {
        toast.info(t("deleteFallbackToast"));
        return;
      }
      setDeletingId(id);
      // Let the exit animation play, then delete; parent removes the row.
      setTimeout(() => {
        fn(id);
        setTimeout(() => setDeletingId(null), 500);
      }, 250);
    },
    [onDeleteChat, onDeleteConversation, t]
  );

  const sectionAction =
    props.sectionActionLabel && props.onSectionAction
      ? {
          label: props.sectionActionLabel,
          isLoading: isCreatingChat,
          onClick: () => {
            props.onSectionAction?.();
            onCloseMobile?.();
          },
        }
      : undefined;

  const sectionLinks: PanelLink[] | undefined =
    section === "images"
      ? [
          { href: "/images", label: t("imageStudio"), icon: ImageIcon },
          { href: "/gallery", label: t("gallery"), icon: LayoutGrid },
          { href: "/describe", label: t("describeTitle"), icon: Search },
        ].map((link) => ({ ...link, current: pathname === link.href }))
      : undefined;

  const panelLabel =
    section === "images"
      ? t("imageStudio")
      : section === "novelcrafter"
        ? t("novelcrafterStudio")
        : props.conversationsLabel || t("yourChats");

  const panelProps = {
    sectionAction,
    sectionLinks,
    showProjects: section === "chat" || section === "pages",
    projects,
    allConversations,
    list,
    listLabel: props.conversationsLabel || t("yourChats"),
    currentId,
    deletingId,
    onSelect: handleSelect,
    onRename: handleRename,
    onDelete: handleDelete,
    onNewProject: () => setShowCreateProject(true),
    onSelectProject: props.onSelectProject,
    onCreateProjectChat: props.onCreateProjectChat,
    onRenameProjectConversation: props.onRenameProjectConversation,
    onDeleteProjectConversation: props.onDeleteProjectConversation,
    onDeleteAll: props.onDeleteAll,
  };

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <AppRail
          onNewChat={handleNewChat}
          isCreatingChat={isCreatingChat}
          onOpenCommandPalette={props.onOpenCommandPalette}
          panelCollapsed={collapsed}
          onTogglePanel={props.onToggleCollapse}
          user={props.session?.user}
          onLogout={props.onLogout}
        />

        {!collapsed && (
          <aside
            aria-label={panelLabel}
            className="hidden md:flex flex-col fixed top-0 bottom-0 left-[calc(4rem+var(--sal,0px))] w-68 z-20 border-r border-(--line) bg-(--surface) px-3 py-4"
          >
            <ContextPanelContent {...panelProps} />
          </aside>
        )}

        <MobileNavDrawer
          open={mobileOpen}
          onClose={onCloseMobile}
          onLogoClick={props.onLogoClick}
          pathname={pathname}
          onNewChat={handleNewChat}
          isCreatingChat={isCreatingChat}
          onAdmin={props.session?.user?.rank === "admin" ? () => router.push("/admin") : undefined}
          onLogout={props.onLogout}
          renderContent={(leading, footer) => (
            <ContextPanelContent {...panelProps} leading={leading} footer={footer} />
          )}
        />
      </TooltipProvider>

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSuccess={() => fetchProjects()}
      />
    </>
  );
}

export default React.memo(Sidebar);
