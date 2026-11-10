"use client";

import React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "../hooks/useLanguage";

interface ChatHeaderProps {
  title?: string | null;
  projectName?: string | null;
  onRename?: () => void;
  onDelete?: () => void;
}

/** Desktop header for an open conversation: title, project line and conversation actions. */
export default function ChatHeader({ title, projectName, onRename, onDelete }: ChatHeaderProps) {
  const { t } = useLanguage();
  const hasActions = Boolean(onRename || onDelete);

  return (
    <header className="hidden md:flex h-15 shrink-0 items-center justify-between gap-4 border-b border-(--line) bg-(--bg) px-6">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-(--text)">
          {title?.trim() || t("newChat")}
        </h2>
        {projectName && (
          <p className="truncate text-xs text-(--muted)">
            {t("chatInProject")} · {projectName}
          </p>
        )}
      </div>

      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("chatHeaderMore")}
              title={t("chatHeaderMore")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-(--muted) hover:bg-(--raised) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              <MoreHorizontal aria-hidden className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {onRename && (
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={onRename}>
                <Pencil aria-hidden className="h-4 w-4" />
                {t("renameChat")}
              </DropdownMenuItem>
            )}
            {onRename && onDelete && <DropdownMenuSeparator />}
            {onDelete && (
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-(--danger) focus:text-(--danger)"
                onClick={onDelete}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
