"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLanguage } from "../hooks/useLanguage";
import { Keyboard } from "lucide-react";

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();

  const isMac =
    typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";

  const shortcuts = [
    {
      description: t("shortcutCommandPalette") || "Open command palette",
      keys: [modKey, "K"],
    },
    {
      description: t("shortcutNewChat") || "Start new chat",
      keys: [modKey, "Shift", "O"],
    },
    {
      description: t("shortcutFocusInput") || "Focus chat input",
      keys: [modKey, "/"],
    },
    {
      description: t("shortcutCloseModal") || "Close active modal / cancel action",
      keys: ["Esc"],
    },
    {
      description: t("shortcutOpenShortcuts") || "Show keyboard shortcuts",
      keys: ["?"],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-(--surface) border-(--line)">
        <DialogHeader>
          <div className="flex items-center gap-2 text-(--text)">
            <Keyboard className="w-5 h-5 text-(--accent)" />
            <DialogTitle className="text-lg font-bold">
              {t("keyboardShortcuts") || "Keyboard Shortcuts"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-(--muted)">
            {t("keyboardShortcutsDesc") || "Quick navigation and productivity shortcuts"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2.5">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-(--raised)/50 hover:bg-(--raised)/60 transition-colors"
            >
              <span className="text-sm text-(--text)">{sc.description}</span>
              <div className="flex items-center gap-1">
                {sc.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-1 text-xs font-mono font-semibold rounded bg-(--raised) border border-(--line) text-(--muted) shadow-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;
