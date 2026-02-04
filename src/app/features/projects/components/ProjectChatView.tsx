"use client";

import React, { useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { FilePlus, Plus, MoreHorizontal, Pencil, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ProjectWithStats } from "@/types/projects";
import type { FrontendConversation } from "@/app/features/chat/hooks/useConversation";
import { ProjectIcon } from "@/components/features/projects/ProjectIcon";
import { translations } from "@/lib/utils/config";
import { useLanguageStore } from "@/lib/store/languageStore";

interface ProjectChatViewProps {
  /** Current project */
  project: ProjectWithStats;
  /** Conversations in this project */
  conversations: FrontendConversation[];
  /** Create new chat in this project */
  onNewChat: () => void;
  /** Select a conversation */
  onSelectConversation: (id: string) => void;
  /** Open project settings/KB page */
  onOpenSettings: () => void;
  /** Rename a conversation */
  onRenameConversation?: (id: string) => void;
  /** Delete a conversation */
  onDeleteConversation?: (id: string) => void;
}

/**
 * Project chat view - ChatGPT-style project landing page
 */
export function ProjectChatView({
  project,
  conversations,
  onNewChat,
  onSelectConversation,
  onOpenSettings,
  onRenameConversation,
  onDeleteConversation,
}: ProjectChatViewProps) {
  const language = useLanguageStore((state) => state.language);
  const t = translations[language];

  // Sort conversations by updatedAt (newest first)
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      return bTime - aTime;
    });
  }, [conversations]);

  // Format date for display
  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return language === "vi" ? "Hôm nay" : "Today";
    if (diffDays === 1) return language === "vi" ? "Hôm qua" : "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { weekday: "short" });
    return date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleExport = (conv: FrontendConversation) => {
    const content = `# ${conv.title || "Conversation"}\n\nExported from Vikini Chat`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conv.title || "conversation"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main content - ChatGPT style centered layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-12">
          {/* Project Header - Centered like ChatGPT */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <ProjectIcon icon={project.icon} color={project.color} size="lg" />
              <h1 className="text-xl font-semibold">{project.name}</h1>
            </div>

            {/* Add files button - Simple like ChatGPT */}
            <button
              onClick={onOpenSettings}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                "border border-(--border) bg-(--surface)/80 backdrop-blur-sm",
                "hover:bg-(--control-bg-hover) hover:border-(--border-hover)",
                "transition-all duration-200 shadow-sm"
              )}
            >
              <FilePlus className="h-4 w-4" />
              {language === "vi" ? "Thêm files & Cài đặt" : "Add files & Settings"}
            </button>
          </div>

          {/* New Chat Input - Like ChatGPT input style */}
          <button
            onClick={onNewChat}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-4 rounded-2xl mb-8",
              "bg-(--surface)/60 backdrop-blur-sm border border-(--border)",
              "hover:border-(--primary)/50 hover:bg-(--surface)/80",
              "transition-all duration-200 shadow-sm",
              "text-left group"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-full bg-(--control-bg) group-hover:bg-(--primary)/20",
                "transition-colors duration-200"
              )}
            >
              <Plus className="h-4 w-4 text-(--text-secondary) group-hover:text-(--primary)" />
            </div>
            <span className="text-(--text-secondary) group-hover:text-(--text-primary) transition-colors">
              {t.projectNewChatIn} {project.name}
            </span>
          </button>

          {/* Recent conversations list */}
          {sortedConversations.length > 0 && (
            <div className="space-y-1">
              {sortedConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl",
                    "hover:bg-(--control-bg-hover)/60 transition-all duration-200",
                    "group cursor-pointer"
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  {/* Chat title */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-(--text-primary) group-hover:text-(--primary) transition-colors">
                      {conv.title || t.newChat}
                    </div>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-(--text-muted) mx-4 shrink-0">
                    {formatDate(conv.updatedAt || conv.createdAt)}
                  </span>

                  {/* Action menu - Radix Dropdown */}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)",
                          "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                        )}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        className="z-9999 min-w-48 rounded-xl bg-(--surface-muted)/95 backdrop-blur-xl border border-(--border) shadow-2xl overflow-hidden ring-1 ring-(--border) py-1.5 animate-in fade-in zoom-in-95 duration-200"
                        align="end"
                        sideOffset={5}
                      >
                        {onRenameConversation && (
                          <DropdownMenu.Item
                            onClick={() => onRenameConversation(conv.id)}
                            className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary)"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            {t.projectRename}
                          </DropdownMenu.Item>
                        )}

                        <DropdownMenu.Item
                          onClick={() => handleExport(conv)}
                          className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary)"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t.projectExport}
                        </DropdownMenu.Item>

                        {onDeleteConversation && (
                          <>
                            <DropdownMenu.Separator className="h-px bg-(--border) my-1 mx-2" />

                            <DropdownMenu.Item
                              onClick={() => onDeleteConversation(conv.id)}
                              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer outline-none data-highlighted:bg-red-500/10 data-highlighted:text-red-300"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t.projectDelete}
                            </DropdownMenu.Item>
                          </>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {sortedConversations.length === 0 && (
            <div className="text-center py-16">
              <div
                className={cn(
                  "inline-flex items-center justify-center w-16 h-16 rounded-full mb-4",
                  "bg-(--control-bg)/60"
                )}
              >
                <ProjectIcon icon={project.icon} color={project.color} size="lg" />
              </div>
              <p className="text-(--text-secondary) mb-1">{t.projectNoChats}</p>
              <p className="text-sm text-(--text-muted)">{t.projectStartChat}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectChatView;
