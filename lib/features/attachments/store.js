import { create } from "zustand";

export const useAttachmentStore = create((set) => ({
  attachments: [],
  addAttachment: (file) => set((state) => ({ attachments: [...state.attachments, file] })),
  removeAttachment: (id) =>
    set((state) => ({ attachments: state.attachments.filter((f) => f.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),
}));
