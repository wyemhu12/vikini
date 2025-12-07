"use client";

export default function Sidebar({
  chats,
  activeId,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onLogout,
  t,
  titleLoading,
  titleGeneratingId,
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
        {chats.map((c) => {
          const isActive = c.id === activeId;
          const isTitleShimmer =
            titleLoading && titleGeneratingId === c.id && !c.autoTitled;

          return (
            <button
              key={c.id}
              className={`flex w-full items-center justify-between gap-1 rounded-lg px-3 py-2 text-left text-xs ${
                isActive
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-900"
              }`}
              onClick={() => onSelectChat(c.id)}
            >
              <span className="line-clamp-2 flex-1 flex items-center gap-2">
                {isTitleShimmer ? (
                  <span className="inline-flex h-3 w-24 animate-pulse rounded-full bg-neutral-700/70" />
                ) : (
                  <span>{c.title}</span>
                )}
              </span>

              <span className="flex items-center gap-1">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameChat(c.id);
                  }}
                  className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700"
                >
                  ✏
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(c.id);
                  }}
                  className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-red-600 hover:text-white"
                >
                  🗑
                </span>
              </span>
            </button>
          );
        })}
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
