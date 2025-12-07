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
    // ⭐ SỬA 1: thêm h-screen + flex-col để sidebar kéo full chiều cao
    <aside className="hidden h-screen w-64 border-r border-neutral-800 bg-neutral-950 p-3 md:flex md:flex-col">
      
      {/* Nút tạo chat */}
      <button
        onClick={onNewChat}
        className="mb-3 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-black text-sm"
      >
        {t.newChat}
      </button>

      {/* ⭐ SỬA 2: flex-1 + overflow-y-auto để vùng danh sách chats chiếm hết phần giữa */}
      <div className="flex-1 space-y-1 overflow-y-auto">
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
                  <span className="transition-opacity duration-300">
                    {c.title}
                  </span>
                )}

                {isTitleShimmer && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-neutral-600 border-t-transparent" />
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

      {/* ⭐ SỬA 3: nút logout luôn nằm cuối cùng nhờ flex-col + flex-1 ở phía trên */}
      <button
        onClick={onLogout}
        className="mt-4 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
      >
        {t.logout}
      </button>
    </aside>
  );
}
