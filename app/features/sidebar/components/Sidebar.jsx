// /app/features/sidebar/components/Sidebar.jsx
"use client";

import Link from "next/link";
import SidebarItem from "./SidebarItem";
import { useGemStore } from "../../gems/stores/useGemStore";

// Icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const SignOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
  </svg>
);

export default function Sidebar({
  // New props
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAll, 
  onRefresh, 

  // Legacy props
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
  const { openGemModal } = useGemStore();

  const list = Array.isArray(chats)
    ? chats
    : Array.isArray(conversations)
    ? conversations
    : [];

  const currentId = activeId ?? selectedConversationId ?? null;
  // const href = currentId ? `/gems?conversationId=${currentId}` : "/gems"; // OLD

  const handleSelect = (id) => {
    (onSelectChat ?? onSelectConversation)?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  // Handler mở modal Gem thay vì chuyển trang
  const handleOpenGems = () => {
    openGemModal(currentId);
    onCloseMobile?.();
  };

  // ---------- Fallback API calls ----------
  const renameFallback = async (id) => {
    try {
      const current = list.find((c) => c?.id === id);
      const curTitle = current?.title || "";
      const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
      if (nextTitle === null) return;
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
      {/* New chat - THEMED BACKGROUND */}
      <button
        onClick={handleNew}
        className="
          group relative w-full mb-3
          flex items-center justify-center gap-2
          rounded-xl 
          bg-[var(--primary)] text-black
          py-3 px-4
          text-sm font-medium
          border border-transparent
          shadow-sm
          transition-all duration-200 ease-out
          hover:brightness-110 hover:shadow-md hover:-translate-y-0.5
          active:scale-[0.97] active:translate-y-0
        "
        type="button"
      >
        <span className="transition-transform duration-300 group-hover:rotate-90">
          <PlusIcon />
        </span>
        <span>{t?.newChat || "New Chat"}</span>
      </button>

      {/* Explore Gems - MODAL TRIGGER */}
      <button
        onClick={handleOpenGems}
        className="
          group flex items-center gap-3 w-full 
          rounded-lg px-3 py-2.5 mb-4
          text-sm font-medium text-neutral-600 dark:text-neutral-400
          hover:bg-neutral-100 dark:hover:bg-neutral-900 
          hover:text-neutral-900 dark:hover:text-white
          transition-all duration-200 text-left
        "
        type="button"
      >
        {/* Icon also themed now */}
        <span className="p-1 rounded-md text-[var(--primary)] bg-neutral-100 dark:bg-neutral-800 group-hover:bg-[var(--primary)] group-hover:text-black transition-colors">
          <SparklesIcon />
        </span>
        {t?.exploreGems || "Explore Gems"}
      </button>

      <div className="h-px bg-neutral-200 dark:bg-neutral-800 mb-2 mx-2" />

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
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
        {list.length === 0 && (
          <div className="text-center py-10 text-xs text-neutral-400 select-none italic">
            Chưa có cuộc trò chuyện nào
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        {onDeleteAll && (
          <button
            onClick={() => onDeleteAll?.()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            type="button"
          >
            {t?.deleteAll || "Xóa tất cả"}
          </button>
        )}

        {/* SIGN OUT BUTTON - THEMED */}
        {onLogout && (
          <button
            onClick={() => {
              onLogout?.();
              onCloseMobile?.();
            }}
            className="
              w-full flex items-center gap-3 rounded-lg px-3 py-2.5
              text-sm font-medium 
              bg-[var(--primary)] text-black
              hover:brightness-110
              active:scale-[0.98] transition-all duration-200
            "
            type="button"
          >
            <SignOutIcon />
            {t?.signOut || t?.logout || "Sign Out"}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="
          hidden md:flex flex-col
          fixed top-0 left-0 bottom-0
          w-72 lg:w-80
          border-r border-neutral-200 dark:border-neutral-800
          bg-white dark:bg-neutral-950
          p-4
          z-30
        "
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => onCloseMobile?.()}
          />

          {/* Panel */}
          <aside
            className="
              fixed top-0 left-0 bottom-0 z-50
              w-[85vw] max-w-sm
              border-r border-neutral-800
              bg-white dark:bg-neutral-950
              p-4
              shadow-2xl
              flex flex-col
            "
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-6 rounded-full bg-[var(--primary)]"></span>
                {t?.appName || "Vikini"}
              </div>
              <button
                onClick={() => onCloseMobile?.()}
                className="p-2 rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="Close sidebar"
                type="button"
              >
                ✕
              </button>
            </div>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}