import { create } from "zustand";

interface GemStore {
  isOpen: boolean;
  contextConversationId: string | null; // Lưu ID cuộc hội thoại muốn áp Gem

  openGemModal: (conversationId?: string | null) => void;
  closeGemModal: () => void;
}

export const useGemStore = create<GemStore>((set) => ({
  isOpen: false,
  contextConversationId: null,

  openGemModal: (conversationId = null) =>
    set({
      isOpen: true,
      contextConversationId: conversationId,
    }),

  closeGemModal: () =>
    set({
      isOpen: false,
      contextConversationId: null,
    }),
}));

