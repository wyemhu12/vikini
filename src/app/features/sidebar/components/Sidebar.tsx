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
import { usePersonaStore } from "../../personas/stores/usePersonaStore";
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
  Search,
  X,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/lib/store/toastStore";
import { CreateProjectModal } from "@/components/features/projects";
import { shouldCloseDrawer } from "../utils/drawerGesture";
import { useProjectStore } from "@/lib/store/projectStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
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
        "flex items-center gap-3 rounded-lg py-2.5 transition-[background-color,color,transform] duration-200 group active:scale-[0.97] relative",
        isCollapsed ? "justify-center px-0 w-full" : "justify-start px-3 w-full",
        variant === "primary" &&
          "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--accent) font-bold shadow-sm",
        variant === "default" &&
          "text-(--text-secondary) hover:text-(--text-primary) sidebar-accent-bar",
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
  const { t } = useLanguage();
  const { openGemModal } = useGemStore();
  const { openPersonaModal } = usePersonaStore();
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

  const handleNavigation = React.useCallback(
    (path: string, isMobile: boolean) => {
      router.push(path);
      if (isMobile) onCloseMobile?.();
    },
    [router, onCloseMobile]
  );

  const handleSelect = React.useCallback(
    (id: string) => {
      (onSelectChat ?? onSelectConversation)?.(id);
      onCloseMobile?.();
    },
    [onSelectChat, onSelectConversation, onCloseMobile]
  );

  const handleNew = React.useCallback(() => {
    if (isCreatingChat) return;
    onNewChat?.();
    onCloseMobile?.();
  }, [isCreatingChat, onNewChat, onCloseMobile]);

  const handleOpenGems = React.useCallback(() => {
    openGemModal(currentId);
    onCloseMobile?.();
  }, [openGemModal, currentId, onCloseMobile]);

  const handleOpenPersonas = React.useCallback(() => {
    openPersonaModal(currentId);
    onCloseMobile?.();
  }, [openPersonaModal, currentId, onCloseMobile]);

  const renameFallback = React.useCallback(
    async (_id: string) => {
      toast.info(t("renameFallbackToast"));
    },
    [t]
  );

  const deleteFallback = React.useCallback(
    async (_id: string) => {
      toast.info(t("deleteFallbackToast"));
    },
    [t]
  );

  const handleRename = React.useCallback(
    (id: string) => (typeof onRenameChat === "function" ? onRenameChat(id) : renameFallback(id)),
    [onRenameChat, renameFallback]
  );

  const handleDelete = React.useCallback(
    (id: string) => {
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
    },
    [onDeleteChat, onDeleteConversation, deleteFallback]
  );

  // renderSidebarContent is a render function (NOT a component) - prevents remount/flicker
  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = isMobile ? false : collapsed;

    const navButtons = (
      <div className="space-y-2">
        <SidebarButton
          onClick={() => handleNavigation("/", isMobile)}
          icon={MessageSquare}
          label={t("chat")}
          variant={pathname === "/" ? "primary" : "default"}
          isCollapsed={isCollapsed}
        />
        {pathname === "/" && (
          <>
            <SidebarButton
              onClick={handleOpenGems}
              icon={Sparkles}
              label={t("exploreGems")}
              className="ml-6 scale-95 origin-left opacity-80"
              isCollapsed={isCollapsed}
            />
            <SidebarButton
              onClick={handleOpenPersonas}
              icon={Sparkles}
              label={t("managePersonas")}
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
                  <p className="text-xs text-(--text-secondary)">{t("gemsDesc")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        <SidebarButton
          onClick={() => handleNavigation("/novelcrafter", isMobile)}
          icon={BookOpen}
          label={t("novelcrafterStudio")}
          variant={pathname?.includes("/novelcrafter") ? "primary" : "default"}
          isCollapsed={isCollapsed}
        />
        <SidebarButton
          onClick={() => handleNavigation("/images", isMobile)}
          icon={ImageIcon}
          label={t("imageStudio")}
          variant={pathname?.includes("/images") ? "primary" : "default"}
          isCollapsed={isCollapsed}
        />
        {pathname?.includes("/images") && (
          <SidebarButton
            onClick={() => handleNavigation("/describe", isMobile)}
            icon={Search}
            label={t("describeTitle")}
            className="ml-6 scale-95 origin-left opacity-80"
            isCollapsed={isCollapsed}
          />
        )}
        <SidebarButton
          onClick={() => handleNavigation("/gallery", isMobile)}
          icon={LayoutGrid}
          label={t("gallery")}
          variant={pathname?.includes("/gallery") ? "primary" : "default"}
          isCollapsed={isCollapsed}
        />
      </div>
    );

    return (
      <div className="flex flex-col flex-1 min-h-0 text-(--text-primary)">
        {/* Actions - Fixed top button */}
        <div className="shrink-0 mb-2">
          <SidebarButton
            onClick={handleNew}
            icon={Plus}
            label={newChatLabel || t("newChat")}
            variant="primary"
            isCollapsed={isCollapsed}
            isLoading={isCreatingChat}
          />
        </div>

        {/* Desktop Navigation Links - Fixed on top when !isMobile */}
        {!isMobile && (
          <div className="shrink-0 mb-2">
            {navButtons}
            <div className={cn("h-px bg-(--border)/60 mt-2 mx-2", isCollapsed && "hidden")} />
          </div>
        )}

        {/* Middle Unified Scroll Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 pb-2 space-y-2 custom-scrollbar">
          {/* Mobile Navigation Links - Inside scroll area on mobile */}
          {isMobile && (
            <>
              {navButtons}
              <div className="h-px bg-(--border)/60 my-2 mx-2" />
            </>
          )}

          {/* Projects Section */}
          {!isCollapsed &&
            !pathname?.includes("/images") &&
            !pathname?.includes("/novelcrafter") && (
              <SidebarSection
                label={t("projects")}
                storageKey="projects"
                defaultExpanded={true}
                count={projects.length}
                action={{
                  label: t("newProject"),
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => setShowCreateProject(true),
                }}
              >
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <FolderPlus className="w-6 h-6 text-(--text-secondary) opacity-50" />
                    <span className="text-xs text-(--text-secondary)">{t("noProjects")}</span>
                    <span className="text-xs text-(--text-secondary)">
                      {t("createProjectHint")}
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
            )}

          {/* Divider between Projects and Chats */}
          {!isCollapsed &&
            !pathname?.includes("/images") &&
            !pathname?.includes("/novelcrafter") && (
              <div className="h-px bg-(--border)/40 my-2 mx-2" />
            )}

          {/* Your chats Section */}
          {!isCollapsed && (
            <SidebarSection
              label={t("yourChats")}
              storageKey="your-chats"
              defaultExpanded={true}
              count={list.length}
            >
              {list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <MessageSquarePlus className="w-6 h-6 text-(--text-secondary) opacity-50" />
                  <span className="text-xs text-(--text-secondary)">{t("noConversations")}</span>
                  <span className="text-xs text-(--text-secondary)">{t("startChatHint")}</span>
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
          )}
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 pt-3 space-y-2 border-t border-(--border)">
          {onDeleteAll && !isCollapsed && (
            <SidebarButton
              onClick={() => onDeleteAll?.()}
              icon={Trash2}
              label={t("deleteAll")}
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
                label={isCollapsed ? t("expand") : t("collapse")}
                isCollapsed={isCollapsed}
              />
            </div>
          )}
          {/* Admin */}
          {session?.user?.rank === "admin" && (
            <SidebarButton
              onClick={() => router.push("/admin")}
              icon={Shield}
              label={t("adminManagement")}
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
              label={t("signOut")}
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
          aria-label={t("navigation")}
          role="navigation"
          className={cn(
            "hidden md:flex flex-col fixed top-0 left-0 bottom-0 border-r border-(--border) bg-(--surface-muted)/90 backdrop-blur-3xl pl-[calc(1rem+var(--sal,0px))] pr-4 py-4 z-30 transition-[width] duration-300",
            collapsed
              ? "w-[calc(5rem+var(--sal,0px))]"
              : "w-[calc(18rem+var(--sal,0px))] lg:w-[calc(20rem+var(--sal,0px))]"
          )}
        >
          {renderSidebarContent()}
        </aside>

        {/* Mobile drawer - Radix Dialog for focus trap + ESC close */}
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
                      className="fixed inset-0 z-(--z-drawer) bg-(--surface-muted)/80 backdrop-blur-sm md:hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.aside
                      aria-label={t("navigation")}
                      role="navigation"
                      className="fixed top-0 left-0 bottom-0 z-(--z-drawer) w-[85vw] max-w-sm border-r border-(--border) bg-(--surface-muted) p-5 pt-[calc(1.25rem+var(--sat,0px))] pb-[calc(4rem+var(--sab,0px))] pl-[calc(1.25rem+var(--sal,0px))] shadow-2xl flex flex-col md:hidden"
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
                      drag="x"
                      dragDirectionLock
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0.5, right: 0 }}
                      dragSnapToOrigin
                      onDragEnd={(_, info) => {
                        if (shouldCloseDrawer(info)) {
                          onCloseMobile?.();
                        }
                      }}
                    >
                      <Dialog.Title className="sr-only">{t("navigation")}</Dialog.Title>
                      {/* Mobile header */}
                      <div className="mb-4 flex items-center justify-between shrink-0">
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
                          {t("appName")}
                        </Link>
                        <Dialog.Close asChild>
                          <button
                            aria-label={t("closeSidebar")}
                            className="p-2 rounded-full text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                          >
                            <X className="w-5 h-5" />
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
