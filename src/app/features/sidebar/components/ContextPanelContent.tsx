"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  FolderPlus,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";
import ProjectNode from "./ProjectNode";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { FrontendConversation } from "../../chat/hooks/useConversation";
import type { ProjectWithStats } from "@/types/projects";
import { cn } from "@/lib/utils/cn";

export interface PanelConversation {
  id: string;
  title?: string;
  model?: string;
  gem?: { name: string; icon: string | null; color: string | null } | null;
  createdAt?: string | number;
  updatedAt?: string | number;
  [key: string]: unknown;
}

// ---- Module-level SidebarButton (stable identity across re-renders) ----
interface SidebarButtonProps {
  onClick?: () => void;
  href?: string;
  icon: LucideIcon;
  label: string;
  variant?: "default" | "primary" | "destructive";
  current?: boolean;
  className?: string;
  isLoading?: boolean;
}

export const SidebarButton = React.memo(function SidebarButton({
  onClick,
  href,
  icon: Icon,
  label,
  variant = "default",
  current = false,
  className,
  isLoading = false,
}: SidebarButtonProps) {
  const classes = cn(
    "flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2.5 transition-[background-color,color,transform] duration-200 group active:scale-[0.97] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
    variant === "primary" &&
      "bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-(--accent) font-bold shadow-sm",
    variant === "default" &&
      "text-(--text-secondary) hover:text-(--text-primary) sidebar-accent-bar",
    variant === "default" && current && "bg-(--soft) text-(--accent)",
    variant === "destructive" &&
      "text-(--text-secondary) hover:bg-(--danger)/10 hover:text-(--danger)",
    isLoading && "opacity-70 cursor-not-allowed",
    className
  );
  const content = (
    <>
      <span
        className={cn(
          "shrink-0 transition-transform duration-300",
          variant === "primary" && !isLoading && "group-hover:rotate-90"
        )}
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      </span>
      <span className="text-sm font-medium truncate">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={current ? "page" : undefined}
        className={classes}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={isLoading ? undefined : onClick}
      disabled={isLoading}
      className={classes}
    >
      {content}
    </button>
  );
});

export interface PanelLink {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
}

interface ContextPanelContentProps {
  /** Nav block rendered at the top of the scroll area (mobile drawer only). */
  leading?: React.ReactNode;
  sectionAction?: { label: string; onClick: () => void; isLoading?: boolean };
  sectionLinks?: readonly PanelLink[];
  onNavigate?: () => void;
  showProjects: boolean;
  projects: readonly ProjectWithStats[];
  allConversations: readonly FrontendConversation[];
  list: readonly PanelConversation[];
  listLabel: string;
  currentId: string | null;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onNewProject: () => void;
  onSelectProject?: (projectId: string) => void;
  onCreateProjectChat?: (projectId: string) => Promise<void>;
  onRenameProjectConversation?: (id: string) => void;
  onDeleteProjectConversation?: (id: string) => void;
  onDeleteAll?: () => void;
  footer?: React.ReactNode;
}

/** Section content of the context panel / mobile drawer: action, links, projects, chats. */
export default function ContextPanelContent(props: ContextPanelContentProps) {
  const { t } = useLanguage();
  const { list, sectionAction, sectionLinks, onNavigate } = props;

  return (
    <div className="flex flex-col flex-1 min-h-0 text-(--text-primary)">
      {sectionAction && (
        <div className="shrink-0 mb-2">
          <SidebarButton
            onClick={sectionAction.onClick}
            icon={Plus}
            label={sectionAction.label}
            variant="primary"
            isLoading={sectionAction.isLoading}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 pb-2 space-y-2 custom-scrollbar">
        {props.leading}

        {sectionLinks && sectionLinks.length > 0 && (
          <div className="space-y-1">
            {sectionLinks.map((link) => (
              <SidebarButton
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                icon={link.icon}
                label={link.label}
                current={link.current}
              />
            ))}
            <div className="h-px bg-(--border)/60 my-2 mx-2" />
          </div>
        )}

        {props.showProjects && (
          <>
            <SidebarSection
              label={t("projects")}
              storageKey="projects"
              defaultExpanded={true}
              count={props.projects.length}
              action={{
                label: t("newProject"),
                icon: <Plus className="h-4 w-4" />,
                onClick: props.onNewProject,
              }}
            >
              {props.projects.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <FolderPlus className="w-6 h-6 text-(--text-secondary) opacity-50" />
                  <span className="text-xs text-(--text-secondary)">{t("noProjects")}</span>
                  <span className="text-xs text-(--text-secondary)">{t("createProjectHint")}</span>
                </div>
              ) : (
                props.projects.map((project) => (
                  <ProjectNode
                    key={project.id}
                    project={project}
                    conversations={props.allConversations.filter((c) => c.projectId === project.id)}
                    activeConversationId={props.currentId}
                    onSelect={(projectId) => props.onSelectProject?.(projectId)}
                    onSelectConversation={props.onSelect}
                    onNewChat={async (projectId) => {
                      await props.onCreateProjectChat?.(projectId);
                    }}
                    onRenameConversation={props.onRenameProjectConversation}
                    onDeleteConversation={props.onDeleteProjectConversation}
                  />
                ))
              )}
            </SidebarSection>
            <div className="h-px bg-(--border)/40 my-2 mx-2" />
          </>
        )}

        <SidebarSection
          label={props.listLabel}
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
                  isActive={c.id === props.currentId}
                  isDeleting={c.id === props.deletingId}
                  onSelect={props.onSelect}
                  onRename={props.onRename}
                  onDelete={props.onDelete}
                />
              ))}
            </AnimatePresence>
          )}
        </SidebarSection>
      </div>

      {(props.onDeleteAll || props.footer) && (
        <div className="shrink-0 pt-3 space-y-2 border-t border-(--border)">
          {props.onDeleteAll && (
            <SidebarButton
              onClick={props.onDeleteAll}
              icon={Trash2}
              label={t("deleteAll")}
              variant="destructive"
              className="text-xs"
            />
          )}
          {props.footer}
        </div>
      )}
    </div>
  );
}
