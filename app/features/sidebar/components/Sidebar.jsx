// /app/features/sidebar/components/Sidebar.jsx
"use client";

import SidebarItem from "./SidebarItem";
import { useGemStore } from "../../gems/stores/useGemStore";

// Icons
const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-5 h-5"
  >
    <path
      fillRule="evenodd"
      d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
      clipRule="evenodd"
    />
  </svg>
);

const SparklesIcon = () => (
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
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
    />
  </svg>
);

const SignOutIcon = () => (
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
      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
    />
  </svg>
);

const ShieldIcon = () => (
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
      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
    />
  </svg>
);

export default function Sidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onDeleteAll,
  onRefresh,
  chats,
  activeId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  onLogout,
  t,
  mobileOpen = false,
  onCloseMobile,
  session, // NEW: session prop for rank check
}) {
  const { openGemModal } = useGemStore();

  const list = Array.isArray(chats) ? chats : Array.isArray(conversations) ? conversations : [];

  const currentId = activeId ?? selectedConversationId ?? null;

  const handleSelect = (id) => {
    (onSelectChat ?? onSelectConversation)?.(id);
    onCloseMobile?.();
  };

  const handleNew = () => {
    onNewChat?.();
    onCloseMobile?.();
  };

  const handleOpenGems = () => {
    openGemModal(currentId);
    onCloseMobile?.();
  };

  const renameFallback = async (id) => {
    try {
      const current = list.find((c) => c?.id === id);
      const curTitle = current?.title || "";
      const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
      if (nextTitle) {
        const title = String(nextTitle).trim();
        await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, title }),
        });
        await onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteFallback = async (id) => {
    try {
      if (window.confirm("Xoá cuộc hội thoại này?")) {
        await fetch("/api/conversations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (currentId === id) {
          const next = list.find((c) => c?.id && c.id !== id);
          if (next?.id) handleSelect(next.id);
        }
        await onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = (id) =>
    typeof onRenameChat === "function" ? onRenameChat(id) : renameFallback(id);
  const handleDelete = (id) => {
    const fn = onDeleteChat ?? onDeleteConversation;
    return typeof fn === "function" ? fn(id) : deleteFallback(id);
  };

  const content = (
    <div className="flex flex-col h-full text-white">
      {/* New chat - THEMED GLASS */}
      <button
        onClick={handleNew}
        className="
          group relative w-full mb-3
          flex items-center justify-center gap-2
          rounded-xl 
          bg-white/10 hover:bg-white/15 border border-white/10
          py-3 px-4
          text-sm font-bold tracking-wide
          shadow-lg backdrop-blur-md
          transition-all duration-300
          hover:scale-[1.02] active:scale-[0.98]
        "
        type="button"
      >
        <span className="transition-transform duration-300 group-hover:rotate-90 text-[var(--primary)]">
          <PlusIcon />
        </span>
        <span className="text-white group-hover:text-white">{t?.newChat || "New Chat"}</span>
      </button>

      {/* Explore Gems - GLASS TRIGGER */}
      <button
        onClick={handleOpenGems}
        className="
          group flex items-center gap-3 w-full 
          rounded-lg px-3 py-2.5 mb-6
          text-xs font-bold uppercase tracking-wider text-white/60
          hover:bg-white/5 hover:text-white
          transition-all duration-300 text-left border border-transparent hover:border-white/5
        "
        type="button"
      >
        <span className="p-1 rounded-md text-[var(--primary)] bg-white/5 group-hover:bg-[var(--primary)] group-hover:text-black transition-colors">
          <SparklesIcon />
        </span>
        {t?.exploreGems || "Explore Gems"}
      </button>

      <div className="h-px bg-white/10 mb-4 mx-2" />

      {/* Chat list with CSS Virtualization / Containment */}
      <div
        className="
          flex-1 overflow-y-auto space-y-1 pr-1 
          scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20
        "
        style={{ contentVisibility: "auto", containIntrinsicSize: "0 500px" }}
      >
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
          <div className="text-center py-10 text-[10px] font-bold uppercase tracking-widest text-white/20 select-none">
            {t?.noConversations || "NO CONVERSATIONS"}
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
        {onDeleteAll && (
          <button
            onClick={() => onDeleteAll?.()}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            type="button"
          >
            {t?.deleteAll || "Clear History"}
          </button>
        )}

        {/* ADMIN MANAGEMENT BUTTON - Only for admins */}
        {session?.user?.rank === "admin" && (
          <a
            href="/admin"
            className="
              w-full flex items-center gap-3 rounded-lg px-3 py-3
              text-xs font-bold uppercase tracking-wide
              bg-blue-500/10 border border-blue-500/20 text-blue-400
              hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/30
              active:scale-[0.98] transition-all duration-200
            "
          >
            <ShieldIcon />
            {t?.adminManagement || "Admin Management"}
          </a>
        )}

        {/* SIGN OUT BUTTON - GLASS */}
        {onLogout && (
          <button
            onClick={() => {
              onLogout?.();
              onCloseMobile?.();
            }}
            className="
              w-full flex items-center gap-3 rounded-lg px-3 py-3
              text-xs font-bold uppercase tracking-wide
              bg-white/5 border border-white/5 text-white/70
              hover:bg-white/10 hover:text-white hover:border-white/10
              active:scale-[0.98] transition-all duration-200
            "
            type="button"
          >
            <SignOutIcon />
            {t?.signOut || t?.logout || "Sign Out"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar - LIGHTER GLASSMORPHISM */}
      <aside
        className="
          hidden md:flex flex-col
          fixed top-0 left-0 bottom-0
          w-72 lg:w-80
          border-r border-white/5
          bg-white/[0.03] backdrop-blur-3xl
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
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => onCloseMobile?.()}
          />

          {/* Panel */}
          <aside
            className="
              fixed top-0 left-0 bottom-0 z-50
              w-[85vw] max-w-sm
              border-r border-white/10
              bg-[#0a0a0a]
              p-6
              shadow-2xl
              flex flex-col
            "
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="text-lg font-black tracking-tighter text-white flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 text-[var(--primary)]">
                  V
                </div>
                {t?.appName || "Vikini"}
              </div>
              <button
                onClick={() => onCloseMobile?.()}
                className="p-2 rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
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
