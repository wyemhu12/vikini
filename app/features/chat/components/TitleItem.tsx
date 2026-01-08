// app/components/Chat/TitleItem.tsx
"use client";

// @ts-ignore
import useAutoTitleStore from "@/app/features/chat/hooks/useAutoTitleStore";

interface TitleItemProps {
  id: string;
  defaultTitle?: string;
  isActive?: boolean;
}

export default function TitleItem({ id, defaultTitle, isActive }: TitleItemProps) {
  const finalTitle = useAutoTitleStore((s: any) => s.final[id]);
  const optimisticTitle = useAutoTitleStore((s: any) => s.optimistic[id]);
  const isLoading = useAutoTitleStore((s: any) => s.loading[id]);

  const title = finalTitle || optimisticTitle || defaultTitle || "New Chat";

  return (
    <span
      className={`truncate text-sm ${isActive ? "text-primary" : "text-secondary"}`}
      title={title}
    >
      {title}
      {isLoading && <span className="ml-1 animate-pulse text-secondary">…</span>}
    </span>
  );
}
