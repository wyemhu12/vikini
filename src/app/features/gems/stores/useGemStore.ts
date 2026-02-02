import { create } from "zustand";

interface GemInfo {
  name: string;
  icon: string | null;
  color: string | null;
}

interface GemStore {
  isOpen: boolean;
  contextConversationId: string | null;

  // Callback to patch gem optimistically after gem is applied
  onGemApplied: ((conversationId: string, gem: GemInfo | null) => void) | null;

  openGemModal: (conversationId?: string | null) => void;
  closeGemModal: () => void;
  setOnGemApplied: (
    callback: ((conversationId: string, gem: GemInfo | null) => void) | null
  ) => void;
  triggerGemApplied: (conversationId: string, gem: GemInfo | null) => void;
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

  triggerGemApplied: (conversationId: string, gem: GemInfo | null) => {
    const callback = get().onGemApplied;
    if (callback) callback(conversationId, gem);
  },
}));
