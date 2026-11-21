/**
 * useFileUpload - Unified upload logic hook (picker, global drag & drop, paste, XHR progress).
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { shouldClearQueue } from "@/lib/features/chat/draftConversation";
import type { FileItem } from "@/types/files";
import { useFileStore } from "./store";
import { extractPastedFiles, hydrateQueuedImagePreviews } from "./uploadPresentation";
import {
  buildQueuedUploadItems,
  FILE_ACCEPT,
  uploadFileWithRetry,
  type FileUploadError,
} from "./fileUploadHelpers";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;
const RECENTLY_COMPLETED_TTL_MS = 1400;

interface UseFileUploadOptions {
  conversationId: string | null;
  disabled?: boolean;
  onUploadComplete?: (uploadedFile: FileItem) => void;
  ensureConversationId?: () => Promise<string>;
  isSelfInitiatedUploadRef?: React.MutableRefObject<boolean>;
  onError?: (error: FileUploadError) => void;
}

export function useFileUpload({
  conversationId,
  disabled,
  onUploadComplete,
  ensureConversationId,
  isSelfInitiatedUploadRef,
  onError,
}: UseFileUploadOptions) {
  const isUploading = useFileStore((s) =>
    s.uploadQueue.some(
      (q) => q.status === "queued" || q.status === "uploading" || q.status === "processing"
    )
  );

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevConversationIdRef = useRef<string | null>(conversationId);
  const conversationIdRef = useRef<string | null>(conversationId);
  const onUploadCompleteRef = useRef(onUploadComplete);
  const ensureConversationIdRef = useRef(ensureConversationId);
  const onErrorRef = useRef(onError);
  const isUnmountedRef = useRef(false);
  const uploadSessionIdRef = useRef(0);
  const activeXhrsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const cancelledTempIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const sleepResolversByTempIdRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
    ensureConversationIdRef.current = ensureConversationId;
    onErrorRef.current = onError;
  }, [onUploadComplete, ensureConversationId, onError]);

  const cancelActiveUploads = useCallback(() => {
    uploadSessionIdRef.current += 1;
    cancelledTempIdsRef.current.clear();
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
    for (const resolveSleep of sleepResolversByTempIdRef.current.values()) resolveSleep();
    sleepResolversByTempIdRef.current.clear();
    for (const xhr of activeXhrsRef.current.values()) {
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors on already-settled XHRs
      }
    }
    activeXhrsRef.current.clear();
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      cancelActiveUploads();
      useFileStore.getState().clearQueue();
    };
  }, [cancelActiveUploads]);

  const scheduleManagedTimeout = useCallback((fn: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      if (!isUnmountedRef.current) fn();
    }, delayMs);
    timersRef.current.add(timer);
  }, []);

  const abortableSleep = useCallback((delayMs: number, tempId: string): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (sleepResolversByTempIdRef.current.get(tempId) === done) {
          sleepResolversByTempIdRef.current.delete(tempId);
        }
        clearTimeout(timer);
        timersRef.current.delete(timer);
        resolve();
      };
      const timer = setTimeout(done, delayMs);
      timersRef.current.add(timer);
      sleepResolversByTempIdRef.current.set(tempId, done);
    });
  }, []);

  const cancelUpload = useCallback((tempId: string) => {
    cancelledTempIdsRef.current.add(tempId);
    const xhr = activeXhrsRef.current.get(tempId);
    if (xhr) {
      activeXhrsRef.current.delete(tempId);
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors on already-settled XHR
      }
    }
    const wakeSleep = sleepResolversByTempIdRef.current.get(tempId);
    if (wakeSleep) {
      sleepResolversByTempIdRef.current.delete(tempId);
      wakeSleep();
    }
    useFileStore.getState().removeFromQueue(tempId);
  }, []);

  const dismissUploadError = useCallback((tempId: string) => {
    useFileStore.getState().removeFromQueue(tempId);
  }, []);

  const openFilePicker = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const sessionId = uploadSessionIdRef.current;
      const isStale = () => isUnmountedRef.current || uploadSessionIdRef.current !== sessionId;

      let targetConvId = conversationIdRef.current;
      if (!targetConvId && ensureConversationIdRef.current) {
        if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = true;
        try {
          targetConvId = await ensureConversationIdRef.current();
        } catch (err: unknown) {
          if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
          logger.error("[useFileUpload] Failed to initialize conversation:", err);
          if (!isStale()) {
            onErrorRef.current?.({
              code: "CONVERSATION_INIT_FAILED",
              detail: err instanceof Error ? err.message : undefined,
            });
          }
          return;
        }
      }
      if (isStale() || !targetConvId) return;

      const queuedItems = buildQueuedUploadItems(fileArray, (validationError) => {
        logger.warn("[useFileUpload] File rejected by client validation:", validationError);
        onErrorRef.current?.(validationError);
      });
      if (queuedItems.length === 0) return;

      useFileStore.getState().enqueueFiles(queuedItems);
      hydrateQueuedImagePreviews(
        queuedItems,
        (tempId) => !isStale() && !cancelledTempIdsRef.current.has(tempId),
        (tempId, previewUrl) => useFileStore.getState().setPreviewUrl(tempId, previewUrl)
      );

      for (const item of queuedItems) {
        if (isStale()) break;
        if (cancelledTempIdsRef.current.delete(item.tempId)) continue;

        useFileStore.getState().setStatus(item.tempId, "uploading");

        const result = await uploadFileWithRetry({
          item,
          conversationId: targetConvId,
          activeXhrs: activeXhrsRef.current,
          maxRetries: MAX_RETRIES,
          retryDelayMs: RETRY_DELAY_MS,
          isStale,
          isCancelled: () => cancelledTempIdsRef.current.has(item.tempId),
          sleep: (ms) => abortableSleep(ms, item.tempId),
          onRetry: (attempt) => {
            logger.info(
              `[useFileUpload] Retrying upload for ${item.filename} (attempt ${attempt + 1})`
            );
            useFileStore.getState().updateProgress(item.tempId, 0);
            useFileStore.getState().setStatus(item.tempId, "uploading");
          },
          onProgress: (pct) => {
            if (!isUnmountedRef.current) useFileStore.getState().updateProgress(item.tempId, pct);
          },
          onProcessing: () => {
            if (!isUnmountedRef.current) {
              useFileStore.getState().setStatus(item.tempId, "processing");
            }
          },
          onSuccess: (uploadedFile) => {
            if (uploadedFile && !isUnmountedRef.current) {
              const normalizedFile: FileItem = uploadedFile.conversation_id
                ? uploadedFile
                : { ...uploadedFile, conversation_id: targetConvId };
              useFileStore.getState().completeUpload(item.tempId, normalizedFile);
              onUploadCompleteRef.current?.(normalizedFile);
              scheduleManagedTimeout(
                () => useFileStore.getState().clearRecentlyCompleted(normalizedFile.id),
                RECENTLY_COMPLETED_TTL_MS
              );
            } else {
              useFileStore.getState().removeFromQueue(item.tempId);
            }
          },
        });

        if (result.outcome === "stale") {
          useFileStore.getState().removeFromQueue(item.tempId);
          break;
        }
        if (result.outcome === "cancelled") {
          cancelledTempIdsRef.current.delete(item.tempId);
          useFileStore.getState().removeFromQueue(item.tempId);
          continue;
        }
        if (result.outcome === "error") {
          logger.error("[useFileUpload] File upload failed:", result.error);
          useFileStore
            .getState()
            .setStatus(item.tempId, "error", result.error.detail || result.error.code);
          onErrorRef.current?.(result.error);
          scheduleManagedTimeout(() => useFileStore.getState().removeFromQueue(item.tempId), 5000);
        }
      }
    },
    [abortableSleep, disabled, isSelfInitiatedUploadRef, scheduleManagedTimeout]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) void uploadFiles(e.target.files);
      e.target.value = "";
    },
    [uploadFiles]
  );

  useEffect(() => {
    if (disabled) return;
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) void uploadFiles(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled, uploadFiles]);

  useEffect(() => {
    if (disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const pastedFiles = extractPastedFiles(e.clipboardData?.items);
      if (pastedFiles.length > 0) {
        e.preventDefault();
        void uploadFiles(pastedFiles);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, uploadFiles]);

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    const isSelfInitiated = isSelfInitiatedUploadRef?.current ?? false;
    if (shouldClearQueue(prevId, conversationId, isSelfInitiated)) {
      cancelActiveUploads();
      useFileStore.getState().clearQueue();
    }
    if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
    prevConversationIdRef.current = conversationId;
  }, [conversationId, cancelActiveUploads, isSelfInitiatedUploadRef]);

  return {
    openFilePicker,
    uploadFiles,
    cancelUpload,
    dismissUploadError,
    isDragging,
    fileInputRef,
    fileAccept: FILE_ACCEPT,
    handleFileInputChange,
    isUploading,
  };
}
