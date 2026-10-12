// /app/features/chat/components/hooks/useChatShortcuts.ts
"use client";

import { useCallback, useEffect, useState } from "react";

interface UseChatShortcutsOptions {
  onNewChat: () => void | Promise<void>;
}

export interface UseChatShortcutsReturn {
  isCommandPaletteOpen: boolean;
  closeCommandPalette: () => void;
  isShortcutsModalOpen: boolean;
  openShortcutsModal: () => void;
  closeShortcutsModal: () => void;
}

/** True when the event originates from an element the user is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Global keyboard shortcuts for the chat shell:
 * - Cmd/Ctrl + K: toggle Command Palette
 * - Cmd/Ctrl + Shift + O: new chat
 * - ?: open keyboard shortcuts help (ignored while typing)
 */
export function useChatShortcuts({ onNewChat }: UseChatShortcutsOptions): UseChatShortcutsReturn {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const openShortcutsModal = useCallback(() => setIsShortcutsModalOpen(true), []);
  const closeShortcutsModal = useCallback(() => setIsShortcutsModalOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isMod && key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isMod && e.shiftKey && key === "o") {
        e.preventDefault();
        void onNewChat();
        return;
      }

      if (e.key === "?" && !isTypingTarget(e.target) && !isMod && !e.altKey) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNewChat]);

  return {
    isCommandPaletteOpen,
    closeCommandPalette,
    isShortcutsModalOpen,
    openShortcutsModal,
    closeShortcutsModal,
  };
}
