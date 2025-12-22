// app/components/Chat/TitleItem.jsx
"use client";

import useAutoTitleStore from "@/app/hooks/useAutoTitleStore";

export default function TitleItem({ id, defaultTitle, isActive }) {
  const finalTitle = useAutoTitleStore((s) => s.final[id]);
  const optimisticTitle = useAutoTitleStore((s) => s.optimistic[id]);
  const isLoading = useAutoTitleStore((s) => s.loading[id]);

  const title =
    finalTitle ||
    optimisticTitle ||
    defaultTitle ||
    "New Chat";

  return (
    <span
      className={`truncate text-xs ${
        isActive ? "text-white" : "text-neutral-300"
      }`}
      title={title}
    >
      {title}
      {isLoading && (
        <span className="ml-1 animate-pulse text-neutral-500">…</span>
      )}
    </span>
  );
}
