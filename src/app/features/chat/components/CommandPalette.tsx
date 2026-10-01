"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Search, PlusCircle, Keyboard, Moon, Globe, MessageSquare } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { cn } from "@/lib/utils/cn";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenShortcuts: () => void;
  onSelectConversation?: (id: string) => void;
  conversations?: Array<{ id: string; title?: string }>;
}

interface CommandItem {
  id: string;
  title: string;
  category: "actions" | "conversations" | "preferences";
  icon: React.ReactNode;
  perform: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNewChat,
  onOpenShortcuts,
  onSelectConversation,
  conversations = [],
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: "new-chat",
        title: t("shortcutNewChat") || "Start new chat",
        category: "actions",
        icon: <PlusCircle className="w-4 h-4 text-(--accent)" />,
        perform: () => {
          onClose();
          onNewChat();
        },
      },
      {
        id: "shortcuts",
        title: t("shortcutOpenShortcuts") || "Show keyboard shortcuts",
        category: "actions",
        icon: <Keyboard className="w-4 h-4 text-(--accent)" />,
        perform: () => {
          onClose();
          onOpenShortcuts();
        },
      },
      {
        id: "switch-lang",
        title: `${t("language") || "Language"}: ${language === "vi" ? "English" : "Tiếng Việt"}`,
        category: "preferences",
        icon: <Globe className="w-4 h-4 text-(--accent)" />,
        perform: () => {
          setLanguage(language === "vi" ? "en" : "vi");
          onClose();
        },
      },
      {
        id: "switch-theme",
        title: `${t("switchTheme") || "Chuyển giao diện"}: ${theme || "blueprint"}`,
        category: "preferences",
        icon: <Moon className="w-4 h-4 text-(--accent)" />,
        perform: () => {
          toggleTheme();
          onClose();
        },
      },
    ];

    // Add recent conversations
    for (const conv of conversations.slice(0, 15)) {
      list.push({
        id: `conv-${conv.id}`,
        title: conv.title || "New Chat",
        category: "conversations",
        icon: <MessageSquare className="w-4 h-4 text-(--text-secondary)" />,
        perform: () => {
          onClose();
          onSelectConversation?.(conv.id);
        },
      });
    }

    return list;
  }, [
    t,
    language,
    setLanguage,
    theme,
    toggleTheme,
    onNewChat,
    onOpenShortcuts,
    onSelectConversation,
    conversations,
    onClose,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const lower = query.toLowerCase();
    return allCommands.filter((cmd) => cmd.title.toLowerCase().includes(lower));
  }, [allCommands, query]);

  // Handle arrow key and enter navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filtered[selectedIndex];
      if (current) {
        current.perform();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden bg-(--surface-elevated) border-(--border)">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("commandPalette") || "Command Palette"}</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-(--border) gap-3">
          <Search className="w-5 h-5 text-(--text-secondary) shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalettePlaceholder") || "Type a command or search..."}
            className="flex-1 bg-transparent text-(--text-primary) placeholder:text-(--text-secondary) outline-none text-base"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono font-medium rounded bg-(--control-bg) border border-(--border) text-(--text-secondary)">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-(--text-secondary)">
              {t("commandPaletteNoResults") || "No matching commands or chats found"}
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.perform}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer",
                    isSelected
                      ? "bg-(--control-bg-hover) text-(--text-primary)"
                      : "text-(--text-secondary) hover:text-(--text-primary)"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    {cmd.icon}
                    <span className="truncate">{cmd.title}</span>
                  </div>
                  {isSelected && <span className="text-[11px] text-(--accent) font-medium">↵</span>}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
