// app/components/Sidebar/Sidebar.jsx
"use client";

import Link from "next/link";
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
  mobileOpen = false,
  onCloseMobile,
}) {
  const href = activeId ? `/gems?conversationId=${activeId}` : "/gems";

  const handleSelect = (id) => {
    onSelectChat?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  const content = (
    <>
      {/* New chat */}
      <button
        onClick={handleNew}
        className="mb-2 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-black text-sm"
      >
        {t.newChat}
      </button>

      {/* Explore Gems */}
      <Link
        href={href}
        onClick={() => onCloseMobile?.()}
        className="mb-3 block w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
      >
        {t.exploreGems || "Explore Gems"}
      </Link>

      {/* Chat list */}
      <div className="flex-1 space-y-1">
        {chats.map((c) => (
          <SidebarItem
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            onSelect={handleSelect}
            onRename={onRenameChat}
            onDelete={onDeleteChat}
          />
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={() => {
          onLogout?.();
          onCloseMobile?.();
        }}
        className="mt-4 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
      >
        {t.logout}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop sidebar (unchanged behavior) */}
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
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => onCloseMobile?.()}
          />

          {/* Panel */}
          <aside
            className="
              fixed top-0 left-0 bottom-0 z-50
              w-72 max-w-[80vw]
              border-r border-neutral-800
              bg-neutral-950
              p-3
              overflow-y-auto
            "
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-200">
                {t.appName}
              </div>
              <button
                onClick={() => onCloseMobile?.()}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
                aria-label="Close sidebar"
              >
                ✕
              </button>
            </div>
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
