import { create } from "zustand";

interface GemStore {
  isOpen: boolean;
  contextConversationId: string | null;

  // Callback to refresh conversations after gem is applied
  onGemApplied: (() => void) | null;

  openGemModal: (conversationId?: string | null) => void;
  closeGemModal: () => void;
  setOnGemApplied: (callback: (() => void) | null) => void;
  triggerGemApplied: () => void;
}

export const useGemStore = create<GemStore>((set, get) => ({
  isOpen: false,
  contextConversationId: null,
  onGemApplied: null,

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

  setOnGemApplied: (callback) => set({ onGemApplied: callback }),

  triggerGemApplied: () => {
    const callback = get().onGemApplied;
    if (callback) callback();
  },
}));
