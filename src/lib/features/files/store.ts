/**
 * File Store - Zustand store for client-side upload state management.
 *
 * Manages upload queue (in-progress uploads) with per-file progress tracking,
 * stable React render keys (`renderKeyByFileId`) for zero-duplicate in-place
 * completion morphing, local image preview URLs (`localPreviewByFileId`), and
 * transient settle highlights (`recentlyCompletedAt`).
 *
 * All stored structures are plain JSON-serializable arrays/Records (never Set/Map).
 */

import { create } from "zustand";
import type { FileItem, FileUploadProgress } from "@/types/files";
import { revokeSafeObjectUrl } from "./uploadPresentation";

interface FileState {
  /** In-progress upload queue */
  uploadQueue: FileUploadProgress[];

  /** IDs of files that have been sent with a message (hide from input preview) */
  sentFileIds: string[];

  /** Maps persisted file.id -> original tempId so FilePreviewCard preserves DOM identity in place */
  renderKeyByFileId: Record<string, string>;

  /** Maps persisted file.id -> local preview URL (`data:` or `blob:`) carried seamlessly across completion */
  localPreviewByFileId: Record<string, string>;

  /** Maps persisted file.id -> completion timestamp for brief subtle settle highlight */
  recentlyCompletedAt: Record<string, number>;

  /** Add a single file to the upload queue */
  addToQueue: (item: FileUploadProgress) => void;

  /** Add multiple validated files to the upload queue upfront */
  enqueueFiles: (items: FileUploadProgress[]) => void;

  /** Hydrate local preview URL for a queued upload or its already-completed FileItem */
  setPreviewUrl: (tempId: string, previewUrl: string) => void;

  /** Update upload progress (0-100) for a specific file */
  updateProgress: (tempId: string, progress: number) => void;

  /** Update status of a queued file */
  setStatus: (tempId: string, status: FileUploadProgress["status"], error?: string) => void;

  /** Atomically complete an upload: remove from queue and transfer stable key + previewUrl */
  completeUpload: (tempId: string, file: FileItem) => void;

  /** Remove a file from the upload queue (revoking its local previewUrl if present) */
  removeFromQueue: (tempId: string) => void;

  /** Release cached render key, previewUrl (revoked), and completion badge for a deleted file */
  releaseFileMetadata: (fileId: string) => void;

  /** Clear transient completion highlight for a file */
  clearRecentlyCompleted: (fileId: string) => void;

  /** Clear entire upload queue and revoke all managed objectURLs */
  clearQueue: () => void;

  /** Mark file IDs as sent (consumed by a message) */
  markAsSent: (ids: string[]) => void;

  /** Clear sent tracking (e.g. on conversation change) */
  clearSentFileIds: () => void;
}

export const useFileStore = create<FileState>((set) => ({
  uploadQueue: [],
  sentFileIds: [],
  renderKeyByFileId: {},
  localPreviewByFileId: {},
  recentlyCompletedAt: {},

  addToQueue: (item) => set((s) => ({ uploadQueue: [...s.uploadQueue, item] })),

  enqueueFiles: (items) =>
    items.length === 0 ? undefined : set((s) => ({ uploadQueue: [...s.uploadQueue, ...items] })),

  setPreviewUrl: (tempId, previewUrl) =>
    set((s) => {
      const inQueue = s.uploadQueue.some((q) => q.tempId === tempId);
      if (inQueue) {
        return {
          uploadQueue: s.uploadQueue.map((q) => (q.tempId === tempId ? { ...q, previewUrl } : q)),
        };
      }
      const completedEntry = Object.entries(s.renderKeyByFileId).find(([, key]) => key === tempId);
      if (!completedEntry) return s;
      const [fileId] = completedEntry;
      return {
        localPreviewByFileId: { ...s.localPreviewByFileId, [fileId]: previewUrl },
      };
    }),

  updateProgress: (tempId, progress) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.map((q) => (q.tempId === tempId ? { ...q, progress } : q)),
    })),

  setStatus: (tempId, status, error) =>
    set((s) => ({
      uploadQueue: s.uploadQueue.map((q) => {
        if (q.tempId !== tempId) return q;
        const progress = status === "processing" || status === "ready" ? 100 : q.progress;
        return { ...q, status, error, progress };
      }),
    })),

  completeUpload: (tempId, file) =>
    set((s) => {
      const target = s.uploadQueue.find((q) => q.tempId === tempId);
      const nextQueue = s.uploadQueue.filter((q) => q.tempId !== tempId);
      const nextRenderKeys = { ...s.renderKeyByFileId, [file.id]: tempId };
      const nextPreviews = { ...s.localPreviewByFileId };
      if (target?.previewUrl) {
        const previous = nextPreviews[file.id];
        if (previous && previous !== target.previewUrl) {
          revokeSafeObjectUrl(previous);
        }
        nextPreviews[file.id] = target.previewUrl;
      }
      return {
        uploadQueue: nextQueue,
        renderKeyByFileId: nextRenderKeys,
        localPreviewByFileId: nextPreviews,
        recentlyCompletedAt: { ...s.recentlyCompletedAt, [file.id]: Date.now() },
      };
    }),

  removeFromQueue: (tempId) =>
    set((s) => {
      const target = s.uploadQueue.find((q) => q.tempId === tempId);
      if (target?.previewUrl) {
        revokeSafeObjectUrl(target.previewUrl);
      }
      return {
        uploadQueue: s.uploadQueue.filter((q) => q.tempId !== tempId),
      };
    }),

  releaseFileMetadata: (fileId) =>
    set((s) => {
      const preview = s.localPreviewByFileId[fileId];
      if (preview) {
        revokeSafeObjectUrl(preview);
      }
      const { [fileId]: _rk, ...restKeys } = s.renderKeyByFileId;
      const { [fileId]: _lp, ...restPreviews } = s.localPreviewByFileId;
      const { [fileId]: _rc, ...restCompleted } = s.recentlyCompletedAt;
      return {
        renderKeyByFileId: restKeys,
        localPreviewByFileId: restPreviews,
        recentlyCompletedAt: restCompleted,
      };
    }),

  clearRecentlyCompleted: (fileId) =>
    set((s) => {
      if (!(fileId in s.recentlyCompletedAt)) return s;
      const { [fileId]: _removed, ...rest } = s.recentlyCompletedAt;
      return { recentlyCompletedAt: rest };
    }),

  clearQueue: () =>
    set((s) => {
      for (const item of s.uploadQueue) {
        revokeSafeObjectUrl(item.previewUrl);
      }
      for (const url of Object.values(s.localPreviewByFileId)) {
        revokeSafeObjectUrl(url);
      }
      return {
        uploadQueue: [],
        renderKeyByFileId: {},
        localPreviewByFileId: {},
        recentlyCompletedAt: {},
      };
    }),

  markAsSent: (ids) =>
    set((s) => ({
      sentFileIds: [...new Set([...s.sentFileIds, ...ids])],
    })),

  clearSentFileIds: () => set({ sentFileIds: [] }),
}));
