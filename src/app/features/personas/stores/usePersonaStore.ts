import { create } from "zustand";

interface PersonaInfo {
  name: string;
  icon: string | null;
  color: string | null;
}

interface PersonaStore {
  isOpen: boolean;
  contextConversationId: string | null;

  // Callback to patch persona optimistically after persona is applied
  onPersonaApplied: ((conversationId: string, persona: PersonaInfo | null) => void) | null;

  openPersonaModal: (conversationId?: string | null) => void;
  closePersonaModal: () => void;
  setOnPersonaApplied: (
    callback: ((conversationId: string, persona: PersonaInfo | null) => void) | null
  ) => void;
  triggerPersonaApplied: (conversationId: string, persona: PersonaInfo | null) => void;
}

export const usePersonaStore = create<PersonaStore>((set, get) => ({
  isOpen: false,
  contextConversationId: null,
  onPersonaApplied: null,

  openPersonaModal: (conversationId = null) =>
    set({
      isOpen: true,
      contextConversationId: conversationId,
    }),

  closePersonaModal: () =>
    set({
      isOpen: false,
      contextConversationId: null,
    }),

  setOnPersonaApplied: (callback) => set({ onPersonaApplied: callback }),

  triggerPersonaApplied: (conversationId: string, persona: PersonaInfo | null) => {
    const callback = get().onPersonaApplied;
    if (callback) callback(conversationId, persona);
  },
}));
