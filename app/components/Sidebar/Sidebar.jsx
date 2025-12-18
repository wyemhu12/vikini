"use client";

import Link from "next/link";
import SidebarItem from "./SidebarItem";

export default function Sidebar({
  // New props (ChatApp.jsx đang truyền)
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAll, // optional
  onRefresh, // optional

  // Legacy props (file cũ)
  chats,
  activeId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,

  // Shared
  onNewChat,
  onLogout,
  t,
  mobileOpen = false,
  onCloseMobile,
}) {
  const list = Array.isArray(chats)
    ? chats
    : Array.isArray(conversations)
    ? conversations
    : [];

  const currentId = activeId ?? selectedConversationId ?? null;
  const href = currentId ? `/gems?conversationId=${currentId}` : "/gems";

  const handleSelect = (id) => {
    (onSelectChat ?? onSelectConversation)?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  // ---------- Fallback API calls ----------
  const renameFallback = async (id) => {
    try {
      const current = list.find((c) => c?.id === id);
      const curTitle = current?.title || "";
      const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
      if (nextTitle === null) return; // cancel
      const title = String(nextTitle).trim();
      if (!title) return;

      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });

      if (!res.ok) throw new Error("Rename failed");
      await onRefresh?.();
    } catch (e) {
      console.error(e);
      alert("Không đổi tên được. Vui lòng thử lại.");
    }
  };

  const deleteFallback = async (id) => {
    try {
      const ok = window.confirm("Xoá cuộc hội thoại này?");
      if (!ok) return;

      const res = await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Delete failed");

      // If deleting active conversation, switch to another one (if any)
      if (currentId === id) {
        const next = list.find((c) => c?.id && c.id !== id);
        if (next?.id) handleSelect(next.id);
      }

      await onRefresh?.();
    } catch (e) {
      console.error(e);
      alert("Không xoá được. Vui lòng thử lại.");
    }
  };

  const handleRename = (id) => {
    if (typeof onRenameChat === "function") return onRenameChat(id);
    return renameFallback(id);
  };

  const handleDelete = (id) => {
    const fn = onDeleteChat ?? onDeleteConversation;
    if (typeof fn === "function") return fn(id);
    return deleteFallback(id);
  };

  const content = (
    <>
      {/* New chat */}
      <button
        onClick={handleNew}
        className="mb-2 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-black text-sm"
        type="button"
      >
        {t?.newChat}
      </button>

      {/* Explore Gems */}
      <Link
        href={href}
        onClick={() => onCloseMobile?.()}
        className="mb-3 block w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
      >
        {t?.exploreGems || "Explore Gems"}
      </Link>

      {/* Chat list */}
      <div className="flex-1 space-y-1">
        {list.map((c) => (
          <SidebarItem
            key={c.id}
            conversation={c}
            isActive={c.id === currentId}
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Optional actions */}
      {(onRefresh || onDeleteAll) && (
        <div className="mt-3 flex items-center gap-2">
          {onRefresh ? (
            <button
              onClick={() => onRefresh?.()}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
              type="button"
            >
              {t?.refresh || "Refresh"}
            </button>
          ) : null}

          {onDeleteAll ? (
            <button
              onClick={() => onDeleteAll?.()}
              className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
              type="button"
            >
              {t?.deleteAll || "Delete all"}
            </button>
          ) : null}
        </div>
      )}

      {/* Logout (only if wired) */}
      {onLogout ? (
        <button
          onClick={() => {
            onLogout?.();
            onCloseMobile?.();
          }}
          className="mt-4 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
          type="button"
        >
          {t?.logout || t?.signOut || "Log out"}
        </button>
      ) : null}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
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
                {t?.appName || "Vikini"}
              </div>
              <button
                onClick={() => onCloseMobile?.()}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
                aria-label="Close sidebar"
                type="button"
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
