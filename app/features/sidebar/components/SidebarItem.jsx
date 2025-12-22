"use client";

import { memo } from "react";
import TitleItem from "@/app/features/chat/components/TitleItem";

function SidebarItem({ conversation, isActive, onSelect, onRename, onDelete }) {
  const c = conversation;

  return (
    <button
      className={`flex w-full items-center justify-between gap-1.5 rounded-lg px-3.5 py-2.5 text-left text-sm ${
        isActive
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:bg-neutral-900"
      }`}
      onClick={() => onSelect?.(c.id)}
      type="button"
    >
      {/* TITLE */}
      <span className="flex-1 flex items-center gap-2 min-w-0">
        <TitleItem id={c.id} defaultTitle={c.title} isActive={isActive} />
      </span>

      {/* ACTIONS */}
      <span className="flex items-center gap-1 flex-shrink-0">
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onRename === "function") onRename(c.id);
          }}
          className="cursor-pointer rounded px-1.5 py-1 text-xs text-neutral-400 hover:bg-neutral-700"
          title="Rename"
          role="button"
        >
          ✏
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onDelete === "function") onDelete(c.id);
          }}
          className="cursor-pointer rounded px-1.5 py-1 text-xs text-neutral-400 hover:bg-red-600 hover:text-white"
          title="Delete"
          role="button"
        >
          🗑
        </span>
      </span>
    </button>
  );
}

export default memo(SidebarItem);
