"use client";

import useAutoTitleStore from "@/app/hooks/useAutoTitleStore";
import { useMemo } from "react";

/**
 * TitleItem.jsx
 * 
 * Đây là UI component hiển thị title của một conversation,
 * dùng Zustand store để lấy:
 *  - optimistic title (hiển thị ngay lập tức)
 *  - final title (trả từ backend)
 *  - loading state (đang generate)
 *
 * Ưu tiên hiển thị:
 *  1) finalTitle[id]
 *  2) optimisticTitle[id]
 *  3) shimmer khi loading
 *  4) fallback: defaultTitle (từ Firestore)
 */

export default function TitleItem({ id, defaultTitle, isActive }) {
  const optimistic = useAutoTitleStore((s) => s.optimistic[id]);
  const final = useAutoTitleStore((s) => s.final[id]);
  const loading = useAutoTitleStore((s) => s.loading[id]);

  // Chọn title theo priority
  const { showShimmer, title, isOptimistic } = useMemo(() => {
    // Final title đã có → hiển thị ngay
    if (final) {
      return {
        title: final,
        isOptimistic: false,
        showShimmer: false,
      };
    }

    // Optimistic title xuất hiện nhanh, trước final
    if (optimistic) {
      return {
        title: optimistic,
        isOptimistic: true,
        showShimmer: false,
      };
    }

    // Nếu đang loading nhưng chưa có optimistic → shimmer
    if (loading && !optimistic) {
      return {
        title: null,
        isOptimistic: false,
        showShimmer: true,
      };
    }

    // Fallback: title từ Firestore (title cũ, rename, etc.)
    return {
      title: defaultTitle,
      isOptimistic: false,
      showShimmer: false,
    };
  }, [final, optimistic, loading, defaultTitle]);

  // Shimmer UI
  if (showShimmer) {
    return (
      <span className="inline-block h-3 w-28 rounded-md shimmer-block" />
    );
  }

  return (
    <span
      className={`truncate ${
        isOptimistic
          ? "opacity-75 italic animate-fade-in"
          : "animate-fade-in"
      } ${isActive ? "text-white" : "text-neutral-300"}`}
      title={title}
    >
      {title}
    </span>
  );
}
