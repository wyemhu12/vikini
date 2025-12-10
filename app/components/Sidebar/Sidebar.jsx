// app/components/Sidebar/Sidebar.jsx
"use client";

import SidebarItem from "./SidebarItem";

export default function Sidebar({
  chats,
  activeId,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onLogout,
  t,
}) {
  return (
    <aside
      className="
        hidden md:flex flex-col
        fixed top-0 left-0 bottom-0
        w-64
        border-r border-neutral-800
        bg-neutral-950
        p-3
        overflow-y-auto
      "
    >
      {/* New chat */}
      <button
        onClick={onNewChat}
        className="mb-3 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-black text-sm"
      >
        {t.newChat}
      </button>

      {/* Chat list */}
      <div className="flex-1 space-y-1">
        {chats.map((c) => (
          <SidebarItem
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            onSelect={onSelectChat}
            onRename={onRenameChat}
            onDelete={onDeleteChat}
          />
        ))}
      </div>

      {/* Logout (always bottom) */}
      <button
        onClick={onLogout}
        className="mt-4 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
      >
        {t.logout}
      </button>
    </aside>
  );
}
