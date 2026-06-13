// /app/features/sidebar/components/Sidebar.tsx
"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
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
  MessageSquarePlus,
  FolderPlus,
  Loader2,
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
  /** Indicates if a new chat is currently being created */
  isCreatingChat?: boolean;
}

// ---- Module-level SidebarButton (stable identity across re-renders) ----
interface SidebarButtonProps {
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  variant?: "default" | "primary" | "destructive";
  className?: string;
  isCollapsed?: boolean;
  isLoading?: boolean;
}

const SidebarButton = React.memo(function SidebarButton({
  onClick,
  icon: Icon,
  label,
  variant = "default",
  className,
  isCollapsed = false,
  isLoading = false,
}: SidebarButtonProps) {
  const button = (
    <button
      onClick={isLoading ? undefined : onClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-3 rounded-lg py-2.5 transition-all duration-200 group",
        isCollapsed ? "justify-center px-0 w-full" : "justify-start px-3 w-full",
        variant === "primary" &&
          "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--accent) font-bold shadow-sm",
        variant === "default" &&
          "text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary)",
        variant === "destructive" &&
          "text-(--text-secondary) hover:bg-(--danger)/10 hover:text-(--danger)",
        isLoading && "opacity-70 cursor-not-allowed",
        className
      )}
      type="button"
    >
      <span
        className={cn(
          "shrink-0 transition-transform duration-300",
          variant === "primary" && !isLoading && "group-hover:rotate-90"
        )}
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
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
});

function Sidebar({
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
  isCreatingChat = false,
}: SidebarProps) {
  const { openGemModal } = useGemStore();
  const router = useRouter();
  const pathname = usePathname();
  const { projects, fetchProjects } = useProjectStore();
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Fetch projects on mount
  React.useEffect(() => {
    void fetchProjects();
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
    if (isCreatingChat) return;
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
    if (typeof fn === "function") {
      setDeletingId(id);
      // Give animation time to play, then call actual delete
      setTimeout(() => {
        fn(id);
        // Clear after a delay (parent will remove from list)
        setTimeout(() => setDeletingId(null), 500);
      }, 250);
    } else {
      void deleteFallback(id);
    }
  };

  // renderSidebarContent is a render function (NOT a component) — prevents remount/flicker
  const renderSidebarContent = (isMobile = false) => {
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
            isLoading={isCreatingChat}
          />
          <SidebarButton
            onClick={() => handleNavigation("/")}
            icon={MessageSquare}
            label="Chat"
            variant={pathname === "/" ? "primary" : "default"}
            isCollapsed={isCollapsed}
          />
          {pathname === "/" && (
            <>
              <SidebarButton
                onClick={handleOpenGems}
                icon={Sparkles}
                label={t?.exploreGems || "Explore Gems"}
                className="ml-6 scale-95 origin-left opacity-80"
                isCollapsed={isCollapsed}
              />
              {isCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleOpenGems}
                      className="flex items-center justify-center w-full py-2 text-(--text-secondary) hover:text-(--accent) transition-colors"
                      type="button"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[200px]">
                    <p className="font-medium">GEMs</p>
                    <p className="text-xs text-(--text-secondary)">
                      Custom AI personas with specialized instructions and knowledge
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
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

        {/* Projects Section - own scroll area */}
        {!isCollapsed && !pathname?.includes("/images") && (
          <div className="max-h-[40%] overflow-y-auto pr-1 shrink-0 scrollbar-thin scrollbar-thumb-[var(--control-border)] hover:scrollbar-thumb-[var(--border)]">
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
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <FolderPlus className="w-6 h-6 text-(--text-secondary) opacity-50" />
                  <span className="text-xs text-(--text-secondary)">No projects yet</span>
                  <span className="text-[10px] text-(--text-muted)">
                    Create a project to organize your chats
                  </span>
                </div>
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
          </div>
        )}

        {/* Divider */}
        <div className={cn("h-px bg-(--border)/40 my-2 mx-2", isCollapsed && "hidden")} />

        {/* Your chats Section - own scroll area, fills remaining space */}
        {!isCollapsed && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[var(--control-border)] hover:scrollbar-thumb-[var(--border)]">
            <SidebarSection
              label={t?.yourChats || "Your chats"}
              storageKey="your-chats"
              defaultExpanded={true}
              count={list.length}
            >
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <MessageSquarePlus className="w-6 h-6 text-(--text-secondary) opacity-50" />
                  <span className="text-xs text-(--text-secondary)">
                    {t?.noConversations || "No conversations"}
                  </span>
                  <span className="text-[10px] text-(--text-muted)">Start a new chat to begin</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((c) => (
                    <SidebarItem
                      key={c.id}
                      conversation={c}
                      isActive={c.id === currentId}
                      isDeleting={c.id === deletingId}
                      onSelect={handleSelect}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
            </SidebarSection>
          </div>
        )}

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
              className="text-xs"
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
          aria-label="Main navigation"
          role="navigation"
          className={cn(
            "hidden md:flex flex-col fixed top-0 left-0 bottom-0 border-r border-(--border) bg-(--surface-muted)/90 backdrop-blur-3xl p-4 z-30 transition-[width] duration-300",
            collapsed ? "w-20" : "w-72 lg:w-80"
          )}
        >
          {renderSidebarContent()}
        </aside>

        {/* Mobile drawer — Radix Dialog for focus trap + ESC close */}
        <Dialog.Root
          open={mobileOpen}
          onOpenChange={(open) => {
            if (!open) onCloseMobile?.();
          }}
        >
          <Dialog.Portal forceMount>
            <AnimatePresence>
              {mobileOpen && (
                <>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div
                      className="fixed inset-0 z-40 bg-(--surface-muted)/80 backdrop-blur-sm md:hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.aside
                      aria-label="Main navigation"
                      role="navigation"
                      className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm border-r border-(--border) bg-(--surface-muted) p-6 pb-24 shadow-2xl flex flex-col md:hidden"
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
                    >
                      <Dialog.Title className="sr-only">Navigation</Dialog.Title>
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
                        <Dialog.Close asChild>
                          <button
                            aria-label="Close sidebar"
                            className="p-2 rounded-full text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-colors"
                          >
                            ✕
                          </button>
                        </Dialog.Close>
                      </div>
                      {/* Reuse SidebarContent with isMobile=true (never collapsed) */}
                      {renderSidebarContent(true)}
                    </motion.aside>
                  </Dialog.Content>
                </>
              )}
            </AnimatePresence>
          </Dialog.Portal>
        </Dialog.Root>
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

export default React.memo(Sidebar);
