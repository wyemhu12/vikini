"use client";

import React, { useState, useEffect, useMemo, useRef, useId } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Search, PlusCircle, Keyboard, Moon, Sun, Globe, MessageSquare } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import { cn } from "@/lib/utils/cn";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  /** Chat only: keyboard shortcut help. */
  onOpenShortcuts?: () => void;
  onSelectConversation?: (id: string) => void;
  conversations?: Array<{ id: string; title?: string }>;
  /** Extra commands (e.g. navigation on pages outside Chat), listed after the built-in actions. */
  extraCommands?: readonly CommandItem[];
}

export interface CommandItem {
  id: string;
  title: string;
  category: "actions" | "navigation" | "conversations" | "preferences";
  icon: React.ReactNode;
  perform: () => void;
}

const CATEGORY_ORDER: readonly CommandItem["category"][] = [
  "actions",
  "navigation",
  "preferences",
  "conversations",
];

const CATEGORY_LABEL_KEY: Record<CommandItem["category"], string> = {
  actions: "commandCategoryActions",
  navigation: "commandCategoryNavigation",
  preferences: "commandCategoryPreferences",
  conversations: "commandCategoryConversations",
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNewChat,
  onOpenShortcuts,
  onSelectConversation,
  conversations = [],
  extraCommands,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { mode, toggleMode } = useTheme();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const groupLabelId = (cat: CommandItem["category"]) => `${baseId}-group-${cat}`;
  const optionId = (id: string) => `${baseId}-option-${id}`;

  // Reset query & selection when opened (input focuses synchronously via DialogContent onOpenAutoFocus)
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
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
      ...(onOpenShortcuts
        ? [
            {
              id: "shortcuts",
              title: t("shortcutOpenShortcuts") || "Show keyboard shortcuts",
              category: "actions" as const,
              icon: <Keyboard className="w-4 h-4 text-(--accent)" />,
              perform: () => {
                onClose();
                onOpenShortcuts();
              },
            },
          ]
        : []),
      ...(extraCommands ?? []),
      {
        id: "switch-lang",
        title: `${t("switchLanguageTo")} ${t("targetLanguageLabel")}`,
        category: "preferences",
        icon: <Globe className="w-4 h-4 text-(--accent)" />,
        perform: () => {
          setLanguage(language === "vi" ? "en" : "vi");
          onClose();
        },
      },
      {
        id: "switch-theme",
        title: `${t("switchTheme")}: ${t(mode === "dark" ? "themeModeLight" : "themeModeDark")}`,
        category: "preferences",
        icon:
          mode === "dark" ? (
            <Sun className="w-4 h-4 text-(--accent)" />
          ) : (
            <Moon className="w-4 h-4 text-(--accent)" />
          ),
        perform: () => {
          toggleMode();
          onClose();
        },
      },
    ];

    // Add recent conversations
    for (const conv of conversations.slice(0, 15)) {
      list.push({
        id: `conv-${conv.id}`,
        title: conv.title || t("newChat"),
        category: "conversations",
        icon: <MessageSquare className="w-4 h-4 text-(--muted)" />,
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
    mode,
    toggleMode,
    onNewChat,
    onOpenShortcuts,
    onSelectConversation,
    conversations,
    onClose,
    extraCommands,
  ]);

  const { groupedCommands, flatFiltered } = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const matched = trimmed
      ? allCommands.filter((cmd) => cmd.title.toLowerCase().includes(trimmed))
      : allCommands;

    const groups: Array<{
      category: CommandItem["category"];
      items: Array<{ cmd: CommandItem; flatIndex: number }>;
    }> = [];
    const flat: CommandItem[] = [];

    for (const category of CATEGORY_ORDER) {
      const catItems = matched.filter((cmd) => cmd.category === category);
      if (catItems.length === 0) continue;
      const indexed = catItems.map((cmd) => {
        const flatIndex = flat.length;
        flat.push(cmd);
        return { cmd, flatIndex };
      });
      groups.push({ category, items: indexed });
    }

    return { groupedCommands: groups, flatFiltered: flat };
  }, [allCommands, query]);

  const safeSelectedIndex =
    flatFiltered.length > 0 ? Math.min(selectedIndex, flatFiltered.length - 1) : -1;
  const activeCmd = safeSelectedIndex >= 0 ? flatFiltered[safeSelectedIndex] : undefined;

  useEffect(() => {
    if (!isOpen || !activeCmd) return;
    optionRefs.current.get(activeCmd.id)?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, activeCmd]);

  // Handle arrow key and enter navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatFiltered.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % flatFiltered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatFiltered.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + flatFiltered.length) % flatFiltered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeCmd) {
        activeCmd.perform();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        instant
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
        className="max-w-xl p-0 gap-0 overflow-hidden bg-(--surface) border-(--line)"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("commandPalette") || "Command Palette"}</DialogTitle>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center pl-4 pr-10 py-3 border-b border-(--line) gap-3 focus-within:bg-(--raised)/40">
          <Search aria-hidden="true" className="w-5 h-5 text-(--muted) shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={t("commandPalette") || "Command Palette"}
            aria-expanded={flatFiltered.length > 0}
            aria-autocomplete="list"
            aria-controls={flatFiltered.length > 0 ? listId : undefined}
            aria-activedescendant={activeCmd ? optionId(activeCmd.id) : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalettePlaceholder") || "Type a command or search..."}
            aria-keyshortcuts="Escape"
            data-focus-ring="container"
            className="flex-1 bg-transparent text-(--text) placeholder:text-(--muted) outline-none focus-visible:outline-none focus-visible:ring-0 text-base"
          />
        </div>

        {/* Results List */}
        {flatFiltered.length === 0 ? (
          <div role="status" className="p-6 text-center text-sm text-(--muted)">
            {t("commandPaletteNoResults") || "No matching commands or chats found"}
          </div>
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-label={t("commandPalette") || "Command Palette"}
            className="max-h-80 overflow-y-auto p-2 space-y-2"
          >
            {groupedCommands.map((group) => (
              <div
                key={group.category}
                role="group"
                aria-labelledby={groupLabelId(group.category)}
                className="space-y-0.5"
              >
                <div
                  id={groupLabelId(group.category)}
                  role="presentation"
                  className="px-3 py-1 text-xs font-semibold tracking-wide text-(--faint)"
                >
                  {t(CATEGORY_LABEL_KEY[group.category])}
                </div>
                {group.items.map(({ cmd, flatIndex }) => {
                  const isSelected = flatIndex === safeSelectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      id={optionId(cmd.id)}
                      ref={(el) => {
                        if (el) optionRefs.current.set(cmd.id, el);
                        else optionRefs.current.delete(cmd.id);
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      onClick={cmd.perform}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-colors cursor-pointer",
                        isSelected
                          ? "bg-(--raised) text-(--text)"
                          : "text-(--muted) hover:text-(--text)"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        {cmd.icon}
                        <span className="truncate">{cmd.title}</span>
                      </div>
                      {isSelected && (
                        <span aria-hidden="true" className="text-xs text-(--accent) font-medium">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
