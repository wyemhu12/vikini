import { create } from 'zustand';

export const useGemStore = create((set) => ({
  isOpen: false,
  contextConversationId: null, // Lưu ID cuộc hội thoại muốn áp Gem
  
  openGemModal: (conversationId = null) => set({ 
    isOpen: true, 
    contextConversationId: conversationId 
  }),
  
  closeGemModal: () => set({ 
    isOpen: false, 
    contextConversationId: null 
  }),
}));