"use client";

import { memo } from "react";
import TitleItem from "../Chat/TitleItem";

function SidebarItem({ conversation, isActive, onSelect, onRename, onDelete }) {
  if (conversation.draft) {
    return (
      <div className="px-3 py-2 text-xs italic text-neutral-500">
        New Chat…
      </div>
    );
  }

  return (
    <button
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${
        isActive ? "bg-neutral-800 text-white" : "text-neutral-400"
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      <TitleItem
        id={conversation.id}
        defaultTitle={conversation.title}
        isActive={isActive}
      />
      <span className="flex gap-1">
        <span onClick={(e) => { e.stopPropagation(); onRename(conversation.id); }}>✏</span>
        <span onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}>🗑</span>
      </span>
    </button>
  );
}

export default memo(SidebarItem);
