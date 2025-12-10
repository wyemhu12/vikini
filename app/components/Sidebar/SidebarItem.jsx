// app/components/Sidebar/SidebarItem.jsx
"use client";

import { memo } from "react";
import TitleItem from "../Chat/TitleItem";

function SidebarItem({ conversation, isActive, onSelect, onRename, onDelete }) {
  const c = conversation;

  return (
    <button
      className={`flex w-full items-center justify-between gap-1 rounded-lg px-3 py-2 text-left text-xs ${
        isActive
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:bg-neutral-900"
      }`}
      onClick={() => onSelect(c.id)}
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
            onRename(c.id);
          }}
          className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700"
        >
          ✏
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onDelete(c.id);
          }}
          className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-red-600 hover:text-white"
        >
          🗑
        </span>
      </span>
    </button>
  );
}

// memo để tránh re-render toàn bộ list khi chỉ 1 conv đổi
export default memo(SidebarItem);
