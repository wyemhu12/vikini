// /app/features/sidebar/components/SidebarItem.tsx
"use client";

import React, { memo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import TitleItem from "@/app/features/chat/components/TitleItem";
import { downloadConversationById } from "@/lib/utils/download";
import { toast } from "@/lib/store/toastStore";

const EllipsisVerticalIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
    />
  </svg>
);

const PencilIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-4 h-4 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

interface SidebarItemProps {
  conversation: { id: string; title?: string };
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

function SidebarItem({ conversation, isActive, onSelect, onRename, onDelete }: SidebarItemProps) {
  const c = conversation;
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent closing immediately if needed, but Radix handles this
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadConversationById(c.id, c.title || "conversation");
      toast.success("Download complete");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Download failed";
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative group w-full px-2">
      <button
        className={`relative flex w-full items-center justify-between gap-1.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 ${
          isActive
            ? "bg-(--control-bg-hover) text-(--text-primary) shadow-[0_0_15px_var(--glow)] border border-(--control-border)"
            : "text-(--text-secondary) hover:bg-(--control-bg) hover:text-(--text-primary) border border-transparent"
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
          <div
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-(--control-bg-hover) cursor-pointer transition-opacity duration-200 z-10 ${
              isActive
                ? "opacity-100 text-(--text-primary)"
                : "opacity-0 group-hover:opacity-100 text-(--text-secondary) hover:text-(--text-primary)"
            }`}
            role="button"
            title="Tùy chọn"
            onClick={(e) => e.stopPropagation()} // Stop propagation to prevent selecting chat when clicking menu
          >
            <EllipsisVerticalIcon />
          </div>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-9999 min-w-48 rounded-xl bg-(--surface-muted)/95 backdrop-blur-xl border border-(--border) shadow-2xl overflow-hidden ring-1 ring-(--border) py-1.5 animate-in fade-in zoom-in-95 duration-200"
            align="end"
            sideOffset={5}
          >
            <DropdownMenu.Item
              onClick={(_e) => {
                if (typeof onRename === "function") onRename(c.id);
              }}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary)"
            >
              <PencilIcon />
              Rename
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg) transition-colors cursor-pointer outline-none data-highlighted:bg-(--control-bg) data-highlighted:text-(--text-primary) disabled:opacity-50"
            >
              <DownloadIcon />
              {isDownloading ? "Downloading..." : "Export .txt"}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="h-px bg-(--border) my-1 mx-2" />

            <DropdownMenu.Item
              onClick={(_e) => {
                if (typeof onDelete === "function") onDelete(c.id);
              }}
              className="flex w-full items-center px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer outline-none data-highlighted:bg-red-500/10 data-highlighted:text-red-300"
            >
              <TrashIcon />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export default memo(SidebarItem);
