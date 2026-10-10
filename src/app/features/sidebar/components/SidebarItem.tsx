// /app/features/sidebar/components/SidebarItem.tsx
"use client";

import React, { memo, useState } from "react";
import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pencil, Trash2, Download, Loader2 } from "lucide-react";
import TitleItem from "@/app/features/chat/components/TitleItem";
import { downloadConversationById } from "@/lib/utils/download";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface SidebarItemProps {
  conversation: { id: string; title?: string };
  isActive: boolean;
  isDeleting?: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

function SidebarItem({
  conversation,
  isActive,
  isDeleting = false,
  onSelect,
  onRename,
  onDelete,
}: SidebarItemProps) {
  const c = conversation;
  const { t } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent closing immediately if needed, but Radix handles this
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadConversationById(c.id, c.title || "conversation");
      toast.success(t("downloadComplete"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("downloadFailed");
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      exit={{
        opacity: 0,
        x: -60,
        scale: 0.9,
        transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
      }}
      className={cn(
        "relative group w-full px-2 transition-[opacity,transform] duration-200",
        isDeleting && "opacity-40 scale-[0.97] pointer-events-none"
      )}
    >
      <button
        className={`relative flex w-full items-center justify-between gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none ${
          isActive
            ? "text-(--text-primary) font-medium sidebar-accent-active border border-transparent"
            : "text-(--text-secondary) hover:text-(--text-primary) sidebar-accent-bar border border-transparent"
        }`}
        onClick={() => onSelect?.(c.id)}
        type="button"
      >
        <span className="flex-1 flex items-center gap-2 min-w-0 pr-6">
          <TitleItem id={c.id} defaultTitle={c.title} isActive={isActive} />
        </span>
      </button>

      {/* Radix Dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-(--control-bg-hover) cursor-pointer transition-opacity duration-200 z-10 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none ${
              isActive
                ? "opacity-100 text-(--text-primary)"
                : "opacity-0 group-hover:opacity-100 text-(--text-secondary) hover:text-(--text-primary)"
            }`}
            aria-label={c.title ? `${t("optionsFor")} ${c.title}` : t("conversationOptions")}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-(--z-popover) min-w-48 rounded-xl bg-(--surface-muted)/95 backdrop-blur-xl border border-(--border) shadow-2xl overflow-hidden ring-1 ring-(--border) py-1.5 animate-in fade-in zoom-in-95 duration-200"
            align="end"
            sideOffset={5}
          >
            <DropdownMenu.Item
              onClick={(_e) => {
                if (typeof onRename === "function") onRename(c.id);
              }}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary)"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {t("rename")}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary) disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isDownloading ? t("downloading") : t("exportTxt")}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-(--border) my-1 mx-2" />

            <DropdownMenu.Item
              onClick={(_e) => {
                if (typeof onDelete === "function") onDelete(c.id);
              }}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--danger) hover:text-(--danger) hover:bg-(--danger)/10 transition-colors cursor-pointer outline-none data-highlighted:bg-(--danger)/10 data-highlighted:text-(--danger)"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("delete")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </motion.div>
  );
}

export default memo(SidebarItem);
