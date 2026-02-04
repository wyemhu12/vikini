"use client";

import React, { useState, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronRight, Plus, MoreHorizontal, Pencil, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ProjectWithStats } from "@/types/projects";
import type { FrontendConversation } from "@/app/features/chat/hooks/useConversation";
import { ProjectIcon } from "@/components/features/projects/ProjectIcon";
import { useLanguageStore } from "@/lib/store/languageStore";
import { translations } from "@/lib/utils/config";

interface ProjectNodeProps {
  /** Project data */
  project: ProjectWithStats;
  /** Conversations belonging to this project */
  conversations: FrontendConversation[];
  /** Currently active conversation ID */
  activeConversationId: string | null;
  /** When the project is selected (opens project view) */
  onSelect: (projectId: string) => void;
  /** When a conversation is selected */
  onSelectConversation: (id: string) => void;
  /** When creating a new chat in this project */
  onNewChat: (projectId: string) => void;
  /** When renaming a conversation */
  onRenameConversation?: (id: string) => void;
  /** When deleting a conversation */
  onDeleteConversation?: (id: string) => void;
}

/**
 * Expandable project node in sidebar with nested conversations
 */
export function ProjectNode({
  project,
  conversations,
  activeConversationId,
  onSelect,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
}: ProjectNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const language = useLanguageStore((state) => state.language);
  const t = translations[language];

  // Load expanded state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`project-expanded-${project.id}`);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, [project.id]);

  // Auto-expand if a chat in this project is active
  useEffect(() => {
    if (activeConversationId && conversations.some((c) => c.id === activeConversationId)) {
      setIsExpanded(true);
      localStorage.setItem(`project-expanded-${project.id}`, "true");
    }
  }, [activeConversationId, conversations, project.id]);

  const toggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`project-expanded-${project.id}`, String(newState));
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
    <div className="mb-1">
      {/* Project header */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group",
          "hover:bg-(--control-bg-hover) transition-colors",
          isExpanded && "bg-(--control-bg)/50"
        )}
      >
        {/* Expand chevron */}
        <button onClick={toggleExpand} className="p-0.5 hover:bg-(--control-bg) rounded shrink-0">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-(--text-secondary) transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        {/* Project icon + name - clicking opens project view */}
        <button
          onClick={() => onSelect(project.id)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ProjectIcon icon={project.icon} color={project.color} size="sm" />
          <span className="text-sm truncate">{project.name}</span>
        </button>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewChat(project.id);
            }}
            className="p-1 hover:bg-(--control-bg) rounded text-(--text-secondary) hover:text-(--text-primary)"
            title={t.newChat}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Nested conversations */}
      {isExpanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-(--border)/40 pl-2">
          {conversations.length === 0 ? (
            <div className="px-2 py-2 text-xs text-(--text-muted)">{t.projectNoChatsYet}</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "flex items-center group/chat rounded-md",
                  "hover:bg-(--control-bg-hover) transition-colors",
                  conv.id === activeConversationId && "bg-(--control-bg) text-(--text-primary)"
                )}
              >
                {/* Chat title - clickable */}
                <button
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    "flex-1 min-w-0 px-2 py-1.5 text-sm text-left truncate",
                    conv.id === activeConversationId && "font-medium"
                  )}
                >
                  {conv.title || t.newChat}
                </button>

                {/* Radix Dropdown Menu */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "p-1 mr-1 rounded transition-all",
                        "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)",
                        "opacity-0 group-hover/chat:opacity-100 data-[state=open]:opacity-100"
                      )}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
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
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectNode;
