import { create } from "zustand";

interface AttachmentFile {
  id: string;
  [key: string]: unknown;
}

interface AttachmentStore {
  attachments: AttachmentFile[];
  addAttachment: (file: AttachmentFile) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
}

export const useAttachmentStore = create<AttachmentStore>((set) => ({
  attachments: [],
  addAttachment: (file) => set((state) => ({ attachments: [...state.attachments, file] })),
  removeAttachment: (id) =>
    set((state) => ({ attachments: state.attachments.filter((f) => f.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),
}));
