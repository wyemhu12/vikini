/**
 * File Store — Zustand store for client-side upload state management.
 *
 * Manages upload queue (in-progress uploads) with per-file progress tracking.
 * The actual file list comes from useFiles() SWR hook, not from this store.
 */

import { create } from "zustand";
import type { FileUploadProgress } from "@/types/files";

interface FileState {
  /** In-progress upload queue */
  uploadQueue: FileUploadProgress[];

  /** IDs of files that have been sent with a message (hide from input preview) */
  sentFileIds: string[];

  /** Add a new file to the upload queue */
  addToQueue: (item: FileUploadProgress) => void;

  /** Update upload progress (0-100) for a specific file */
  updateProgress: (tempId: string, progress: number) => void;

  /** Update status of a queued file */
  setStatus: (tempId: string, status: FileUploadProgress["status"], error?: string) => void;

  /** Remove a file from the upload queue */
  removeFromQueue: (tempId: string) => void;

  /** Clear entire upload queue */
  clearQueue: () => void;

  /** Mark file IDs as sent (consumed by a message) */
  markAsSent: (ids: string[]) => void;

  /** Clear sent tracking (e.g. on conversation change) */
  clearSentFileIds: () => void;
}

export const useFileStore = create<FileState>((set) => ({
  uploadQueue: [],
  sentFileIds: [],

  addToQueue: (item) => set((s) => ({ uploadQueue: [...s.uploadQueue, item] })),

  updateProgress: (tempId, progress) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.map((q) => (q.tempId === tempId ? { ...q, progress } : q)),
    })),

  setStatus: (tempId, status, error) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.map((q) => (q.tempId === tempId ? { ...q, status, error } : q)),
    })),

  removeFromQueue: (tempId) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.filter((q) => q.tempId !== tempId),
    })),

  clearQueue: () => set({ uploadQueue: [] }),

  markAsSent: (ids) =>
    set((s) => ({
      sentFileIds: [...new Set([...s.sentFileIds, ...ids])],
    })),

  clearSentFileIds: () => set({ sentFileIds: [] }),
}));
