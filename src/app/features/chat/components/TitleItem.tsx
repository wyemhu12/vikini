// app/components/Chat/TitleItem.tsx
"use client";

import useAutoTitleStore, {
  type AutoTitleState,
} from "@/app/features/chat/hooks/useAutoTitleStore";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";

interface TitleItemProps {
  id: string;
  defaultTitle?: string;
  isActive?: boolean;
}

export default function TitleItem({ id, defaultTitle, isActive }: TitleItemProps) {
  const { t } = useLanguage();
  const finalTitle = useAutoTitleStore((s: AutoTitleState) => s.final[id]);
  const optimisticTitle = useAutoTitleStore((s: AutoTitleState) => s.optimistic[id]);
  const isLoading = useAutoTitleStore((s: AutoTitleState) => s.loading[id]);

  const title = finalTitle || optimisticTitle || defaultTitle || t("newChat");

  return (
    <span
      className={`truncate text-sm ${isActive ? "text-(--text)" : "text-(--muted)"}`}
      title={title}
    >
      {title}
      {isLoading && <span className="ml-1 animate-pulse text-(--muted)">…</span>}
    </span>
  );
}
