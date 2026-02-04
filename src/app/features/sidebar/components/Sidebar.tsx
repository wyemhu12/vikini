// /app/features/sidebar/components/Sidebar.tsx
"use client";

import React from "react";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";
import ProjectNode from "./ProjectNode";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useGemStore } from "../../gems/stores/useGemStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Shield,
  LogOut,
  Trash2,
  LucideIcon,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/lib/store/toastStore";
import { CreateProjectModal } from "@/components/features/projects";
import { useProjectStore } from "@/lib/store/projectStore";
import type { FrontendConversation } from "../../chat/hooks/useConversation";

interface Conversation {
  id: string;
  title?: string;
  model?: string;
  gem?: { name: string; icon: string | null; color: string | null } | null;
  createdAt?: string | number;
  updatedAt?: string | number;
  [key: string]: unknown;
}

interface SessionUser {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  rank?: string;
  id?: string;
}

interface Session {
  user?: SessionUser;
  expires?: string;
}

interface SidebarProps {
  conversations?: Conversation[];
  selectedConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onDeleteAll?: () => void;
  onRefresh?: () => Promise<void> | void;
  chats?: Conversation[];
  activeId?: string | null;
  onSelectChat?: (id: string) => void;
  onRenameChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onNewChat?: () => void;
  newChatLabel?: string;
  onLogout?: () => void;
  t?: Record<string, string>;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  session?: Session | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogoClick?: () => void;
  /** All conversations for filtering by project */
  allConversations?: FrontendConversation[];
  /** Callback to create a new chat in a project */
  onCreateProjectChat?: (projectId: string) => Promise<void>;
  /** Callback when a project is selected */
  onSelectProject?: (projectId: string) => void;
  /** Callback to rename a project conversation */
  onRenameProjectConversation?: (id: string) => void;
  /** Callback to delete a project conversation */
  onDeleteProjectConversation?: (id: string) => void;
}

export default function Sidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAll,
  onRefresh: _onRefresh,
  chats,
  activeId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  newChatLabel,
  onLogout,
  t,
  mobileOpen = false,
  onCloseMobile,
  session,
  collapsed = false,
  onToggleCollapse,
  onLogoClick,
  allConversations = [],
  onCreateProjectChat,
  onSelectProject,
  onRenameProjectConversation,
  onDeleteProjectConversation,
}: SidebarProps) {
  const { openGemModal } = useGemStore();
  const router = useRouter();
  const pathname = usePathname();
  const { projects, fetchProjects } = useProjectStore();
  const [showCreateProject, setShowCreateProject] = React.useState(false);

  // Fetch projects on mount
  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const list = Array.isArray(chats)
    ? chats
    : Array.isArray(conversations)
      ? conversations || []
      : [];

  const currentId = activeId ?? selectedConversationId ?? null;

  const handleSelect = (id: string) => {
    (onSelectChat ?? onSelectConversation)?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  const handleOpenGems = () => {
    openGemModal(currentId);
    onCloseMobile?.();
  };

  const renameFallback = async (_id: string) => {
    // Note: This fallback should ideally use a modal, but for now we use
    // the parent's onRenameChat which has proper modal handling in ChatApp
    // If no onRenameChat is provided, show a toast suggesting to use the main UI
    toast.info(t?.renameChat || "Use the main interface to rename conversations");
  };

  const deleteFallback = async (_id: string) => {
    // Note: This fallback should ideally use a modal, but for now we use
    // the parent's onDeleteChat which has proper modal handling in ChatApp
    // If no onDeleteChat is provided, show a toast suggesting to use the main UI
    toast.info(t?.deleteConfirm || "Use the main interface to delete conversations");
  };

  const handleRename = (id: string) =>
    typeof onRenameChat === "function" ? onRenameChat(id) : renameFallback(id);
  const handleDelete = (id: string) => {
    const fn = onDeleteChat ?? onDeleteConversation;
    return typeof fn === "function" ? fn(id) : deleteFallback(id);
  };

  // Extracted SidebarButton component
  const SidebarButton = ({
    onClick,
    icon: Icon,
    label,
    variant = "default",
    className,
    isCollapsed = false,
  }: {
    onClick?: () => void;
    icon: LucideIcon;
    label: string;
    variant?: "default" | "primary" | "destructive";
    className?: string;
    isCollapsed?: boolean;
  }) => {
    const button = (
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2.5 transition-all duration-200 group",
          isCollapsed ? "justify-center px-0 w-full" : "justify-start px-3 w-full",
          variant === "primary" &&
            "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--accent) font-bold shadow-sm",
          variant === "default" &&
            "text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary)",
          variant === "destructive" &&
            "text-(--text-secondary) hover:bg-red-500/10 hover:text-red-500",
          className
        )}
        type="button"
      >
        <span
          className={cn(
            "shrink-0 transition-transform duration-300",
            variant === "primary" && "group-hover:rotate-90"
          )}
        >
          <Icon className="w-5 h-5" />
        </span>
        {!isCollapsed && <span className="text-sm font-medium truncate">{label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return button;
  };

  // Extracted SidebarContent - shared between desktop and mobile
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isCollapsed = isMobile ? false : collapsed;

    const handleNavigation = (path: string) => {
      router.push(path);
      if (isMobile) onCloseMobile?.();
    };

    return (
      <div className="flex flex-col h-full text-(--text-primary)">
        {/* Actions */}
        <div className="mb-4 space-y-2">
          <SidebarButton
            onClick={handleNew}
            icon={Plus}
            label={newChatLabel || t?.newChat || "New Chat"}
            variant="primary"
            isCollapsed={isCollapsed}
          />
          <SidebarButton
            onClick={() => handleNavigation("/")}
            icon={MessageSquare}
            label="Chat"
            variant={pathname === "/" ? "primary" : "default"}
            isCollapsed={isCollapsed}
          />
          {pathname === "/" && (
            <SidebarButton
              onClick={handleOpenGems}
              icon={Sparkles}
              label={t?.exploreGems || "Explore Gems"}
              className="ml-6 scale-95 origin-left opacity-80"
              isCollapsed={isCollapsed}
            />
          )}
          <SidebarButton
            onClick={() => handleNavigation("/images")}
            icon={ImageIcon}
            label="Image Studio"
            variant={pathname?.includes("/images") ? "primary" : "default"}
            isCollapsed={isCollapsed}
          />
          <SidebarButton
            onClick={() => handleNavigation("/gallery")}
            icon={LayoutGrid}
            label="Gallery"
            variant={pathname?.includes("/gallery") ? "primary" : "default"}
            isCollapsed={isCollapsed}
          />
        </div>

        {/* Divider */}
        <div className={cn("h-px bg-(--border)/60 mb-2 mx-2", isCollapsed && "hidden")} />

        {/* Scrollable sections container */}
        <div
          className={cn(
            "flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[var(--control-border)] hover:scrollbar-thumb-[var(--border)]",
            isCollapsed && "hidden"
          )}
        >
          {/* Projects Section - Hide only on Image Studio */}
          {!isCollapsed && !pathname?.includes("/images") && (
            <SidebarSection
              label={t?.projects || "Projects"}
              storageKey="projects"
              defaultExpanded={true}
              count={projects.length}
              action={{
                label: "New project",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => setShowCreateProject(true),
              }}
            >
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-xs text-(--text-muted)">No projects yet</div>
              ) : (
                projects.map((project) => {
                  // Get conversations for this project
                  const projectConvs = allConversations.filter((c) => c.projectId === project.id);
                  return (
                    <ProjectNode
                      key={project.id}
                      project={project}
                      conversations={projectConvs}
                      activeConversationId={currentId}
                      onSelect={(projectId) => {
                        if (onSelectProject) {
                          onSelectProject(projectId);
                        }
                      }}
                      onSelectConversation={(id) => {
                        handleSelect(id);
                      }}
                      onNewChat={async (projectId) => {
                        if (onCreateProjectChat) {
                          await onCreateProjectChat(projectId);
                        }
                      }}
                      onRenameConversation={onRenameProjectConversation}
                      onDeleteConversation={onDeleteProjectConversation}
                    />
                  );
                })
              )}
            </SidebarSection>
          )}

          {/* Divider */}
          <div className={cn("h-px bg-(--border)/40 my-2 mx-2", isCollapsed && "hidden")} />

          {/* Your chats Section */}
          {!isCollapsed && (
            <SidebarSection
              label={t?.yourChats || "Your chats"}
              storageKey="your-chats"
              defaultExpanded={true}
              count={list.length}
            >
              {list.length === 0 ? (
                <div className="px-3 py-4 text-xs text-(--text-muted) text-center">
                  {t?.noConversations || "No conversations"}
                </div>
              ) : (
                list.map((c) => (
                  <SidebarItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === currentId}
                    onSelect={handleSelect}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </SidebarSection>
          )}
        </div>

        {/* Placeholder when collapsed */}
        {isCollapsed && (
          <div className="flex-1 flex flex-col items-center pt-4 border-t border-(--border) gap-2" />
        )}

        {/* Footer Actions */}
        <div className={cn("mt-auto pt-4 space-y-2", !isCollapsed && "border-t border-(--border)")}>
          {onDeleteAll && !isCollapsed && (
            <SidebarButton
              onClick={() => onDeleteAll?.()}
              icon={Trash2}
              label={t?.deleteAll || "Clear History"}
              variant="destructive"
              className="text-[10px]"
              isCollapsed={isCollapsed}
            />
          )}
          {/* Toggle Button - Desktop only */}
          {!isMobile && (
            <div className="hidden md:block">
              <SidebarButton
                onClick={onToggleCollapse}
                icon={isCollapsed ? PanelLeftOpen : PanelLeftClose}
                label={isCollapsed ? "Expand" : "Collapse"}
                isCollapsed={isCollapsed}
              />
            </div>
          )}
          {/* Admin */}
          {session?.user?.rank === "admin" && (
            <SidebarButton
              onClick={() => (window.location.href = "/admin")}
              icon={Shield}
              label={t?.adminManagement || "Admin Management"}
              isCollapsed={isCollapsed}
            />
          )}
          {/* Logout */}
          {onLogout && (
            <SidebarButton
              onClick={() => {
                onLogout?.();
                if (isMobile) onCloseMobile?.();
              }}
              icon={LogOut}
              label={t?.signOut || t?.logout || "Sign Out"}
              variant="destructive"
              isCollapsed={isCollapsed}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <TooltipProvider delayDuration={0}>
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden md:flex flex-col fixed top-0 left-0 bottom-0 border-r border-(--border) bg-(--surface-muted)/90 backdrop-blur-3xl p-4 z-30 transition-[width] duration-300",
            collapsed ? "w-20" : "w-72 lg:w-80"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-(--surface-muted)/80 backdrop-blur-sm transition-opacity"
              onClick={() => onCloseMobile?.()}
            />
            <aside className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm border-r border-(--border) bg-(--surface-muted) p-6 pb-24 shadow-2xl flex flex-col">
              {/* Mobile header */}
              <div className="mb-8 flex items-center justify-between">
                <Link
                  href="/"
                  className="text-lg font-black tracking-tighter text-(--text-primary) flex items-center gap-3 active:opacity-70 transition-opacity"
                  onClick={() => {
                    onLogoClick?.();
                    onCloseMobile?.();
                  }}
                >
                  <div className="h-8 w-8 rounded-lg bg-(--control-bg) flex items-center justify-center border border-(--control-border) text-(--accent)">
                    V
                  </div>
                  {t?.appName || "Vikini"}
                </Link>
                <button
                  onClick={() => onCloseMobile?.()}
                  className="p-2 rounded-full text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-colors"
                >
                  ✕
                </button>
              </div>
              {/* Reuse SidebarContent with isMobile=true (never collapsed) */}
              <SidebarContent isMobile />
            </aside>
          </div>
        )}
      </TooltipProvider>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onSuccess={() => fetchProjects()}
      />
    </>
  );
}
