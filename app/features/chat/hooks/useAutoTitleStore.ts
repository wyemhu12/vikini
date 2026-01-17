// app/hooks/useAutoTitleStore.ts
"use client";

import { create } from "zustand";

interface AutoTitleStore {
  optimistic: Record<string, string>;
  final: Record<string, string>;
  loading: Record<string, boolean>;

  // Helpers nội bộ
  _setMapValue: (
    key: "optimistic" | "final" | "loading",
    id: string,
    value: string | boolean
  ) => void;
  _deleteMapKey: (key: "optimistic" | "final" | "loading", id: string) => void;

  // API công khai
  setOptimisticTitle: (conversationId: string, title: string) => void;
  setFinalTitle: (conversationId: string, title: string) => void;
  setTitleLoading: (conversationId: string, isLoading: boolean) => void;
  clearConversationTitle: (conversationId: string) => void;
  resetAllTitles: () => void;
}

/**
 * Auto-title global store (Zustand)
 *
 * - optimistic[conversationId]: title tạm thời (hiển thị ngay)
 * - final[conversationId]: title cuối cùng từ backend
 * - loading[conversationId]: đang generate title hay không
 *
 * Ý tưởng:
 * - Khi gửi tin nhắn mới: setOptimisticTitle(...)
 * - Khi backend trả final title: setFinalTitle(...)
 * - UI (TitleItem.jsx / Sidebar) chỉ cần đọc store này để hiển thị.
 */
const useAutoTitleStore = create<AutoTitleStore>((set, get) => ({
  optimistic: {},
  final: {},
  loading: {},

  // ----- Helpers nội bộ -----
  _setMapValue: (key, id, value) =>
    set((state) => ({
      [key]: {
        ...state[key],
        [id]: value,
      },
    })),

  _deleteMapKey: (key, id) =>
    set((state) => {
      const cloned = { ...state[key] };
      delete cloned[id];
      return { [key]: cloned };
    }),

  // ----- API công khai -----

  // Đặt title optimistic (hiện ngay, có thể khác final)
  setOptimisticTitle: (conversationId, title) => {
    if (!conversationId || !title?.trim()) return;
    const clean = title.trim();
    const { _setMapValue } = get();
    _setMapValue("optimistic", conversationId, clean);
  },

  // Đặt title final (từ backend)
  setFinalTitle: (conversationId, title) => {
    if (!conversationId || !title?.trim()) return;
    const clean = title.trim();
    const { _setMapValue, _deleteMapKey } = get();
    _setMapValue("final", conversationId, clean);
    // Khi đã có final -> bỏ optimistic
    _deleteMapKey("optimistic", conversationId);
    // Đồng thời tắt loading
    _setMapValue("loading", conversationId, false);
  },

  // Đánh dấu 1 conv đang chạy auto-title
  setTitleLoading: (conversationId, isLoading) => {
    if (!conversationId) return;
    const { _setMapValue, _deleteMapKey } = get();
    if (isLoading) {
      _setMapValue("loading", conversationId, true);
    } else {
      _deleteMapKey("loading", conversationId);
    }
  },

  // Xóa toàn bộ state của 1 conversation (khi delete hoặc reset)
  clearConversationTitle: (conversationId) => {
    if (!conversationId) return;
    const { _deleteMapKey } = get();
    _deleteMapKey("optimistic", conversationId);
    _deleteMapKey("final", conversationId);
    _deleteMapKey("loading", conversationId);
  },

  // Reset tất cả (ít dùng, nhưng handy khi logout)
  resetAllTitles: () =>
    set({
      optimistic: {},
      final: {},
      loading: {},
    }),
}));

export default useAutoTitleStore;

// Export type for consumers
export type AutoTitleState = AutoTitleStore;
