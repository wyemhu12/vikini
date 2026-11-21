/**
 * useFileUpload - Unified upload logic hook (picker, global drag & drop, paste, XHR progress).
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { shouldClearQueue } from "@/lib/features/chat/draftConversation";
import type { FileItem } from "@/types/files";
import { useFileStore } from "./store";
import {
  createAbortableSleep,
  hydrateQueuedImagePreviews,
  safeAbortXhr,
} from "./uploadPresentation";
import { useGlobalFileDropPaste } from "./useGlobalFileDropPaste";
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
  onConversationResolved?: (conversationId: string) => void;
  onSessionReset?: () => void;
}

export function useFileUpload({
  conversationId,
  disabled,
  onUploadComplete,
  ensureConversationId,
  isSelfInitiatedUploadRef,
  onError,
  onConversationResolved,
  onSessionReset,
}: UseFileUploadOptions) {
  const activeUploadCount = useFileStore(
    (s) =>
      s.uploadQueue.filter(
        (q) => q.status === "queued" || q.status === "uploading" || q.status === "processing"
      ).length
  );
  const isUploading = activeUploadCount > 0;

  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const preparingCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevConversationIdRef = useRef<string | null>(conversationId);
  const conversationIdRef = useRef<string | null>(conversationId);
  const callbacksRef = useRef({
    onUploadComplete,
    ensureConversationId,
    onError,
    onConversationResolved,
    onSessionReset,
  });
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
    callbacksRef.current = {
      onUploadComplete,
      ensureConversationId,
      onError,
      onConversationResolved,
      onSessionReset,
    };
  }, [onUploadComplete, ensureConversationId, onError, onConversationResolved, onSessionReset]);

  const cancelActiveUploads = useCallback(() => {
    uploadSessionIdRef.current += 1;
    preparingCountRef.current = 0;
    if (!isUnmountedRef.current) setIsPreparingUpload(false);
    cancelledTempIdsRef.current.clear();
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
    for (const resolveSleep of sleepResolversByTempIdRef.current.values()) resolveSleep();
    sleepResolversByTempIdRef.current.clear();
    for (const xhr of activeXhrsRef.current.values()) safeAbortXhr(xhr);
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

  const abortableSleep = useCallback(
    (delayMs: number, tempId: string): Promise<void> =>
      createAbortableSleep(delayMs, tempId, timersRef.current, sleepResolversByTempIdRef.current),
    []
  );

  const cancelUpload = useCallback((tempId: string) => {
    cancelledTempIdsRef.current.add(tempId);
    const xhr = activeXhrsRef.current.get(tempId);
    if (xhr) {
      activeXhrsRef.current.delete(tempId);
      safeAbortXhr(xhr);
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

      const queuedItems = buildQueuedUploadItems(fileArray, (validationError) => {
        logger.warn("[useFileUpload] File rejected by client validation:", validationError);
        callbacksRef.current.onError?.(validationError);
      });
      if (queuedItems.length === 0) return;

      // Enqueue & hydrate previews synchronously BEFORE any await so isUploadBusy === true at T0
      useFileStore.getState().enqueueFiles(queuedItems);
      hydrateQueuedImagePreviews(
        queuedItems,
        (tempId) => !isStale() && !cancelledTempIdsRef.current.has(tempId),
        (tempId, previewUrl) => useFileStore.getState().setPreviewUrl(tempId, previewUrl)
      );

      const removeBatchFromQueue = () => {
        for (const item of queuedItems) useFileStore.getState().removeFromQueue(item.tempId);
      };

      let targetConvId = conversationIdRef.current;
      if (!targetConvId && callbacksRef.current.ensureConversationId) {
        if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = true;
        preparingCountRef.current += 1;
        setIsPreparingUpload(true);
        try {
          targetConvId = await callbacksRef.current.ensureConversationId();
          // Check isStale() FIRST before switchedAway / !targetConvId so stale/unmounted
          // sessions never reset a newer conversation or touch store state after unmount.
          if (isStale()) {
            if (!isUnmountedRef.current) removeBatchFromQueue();
            return;
          }
          const switchedAway = Boolean(
            targetConvId && conversationIdRef.current && conversationIdRef.current !== targetConvId
          );
          if (switchedAway) {
            if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
            callbacksRef.current.onSessionReset?.();
            removeBatchFromQueue();
            return;
          }
          if (!targetConvId) {
            if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
            callbacksRef.current.onError?.({ code: "CONVERSATION_INIT_FAILED" });
            removeBatchFromQueue();
            return;
          }
        } catch (err: unknown) {
          logger.error("[useFileUpload] Failed to initialize conversation:", err);
          if (!isStale()) {
            if (isSelfInitiatedUploadRef) isSelfInitiatedUploadRef.current = false;
            callbacksRef.current.onError?.({
              code: "CONVERSATION_INIT_FAILED",
              detail: err instanceof Error ? err.message : undefined,
            });
            removeBatchFromQueue();
          } else if (!isUnmountedRef.current) {
            removeBatchFromQueue();
          }
          return;
        } finally {
          if (!isStale()) {
            preparingCountRef.current = Math.max(0, preparingCountRef.current - 1);
            if (!isUnmountedRef.current && preparingCountRef.current === 0) {
              setIsPreparingUpload(false);
            }
          }
        }
      } else if (!targetConvId) {
        callbacksRef.current.onError?.({ code: "CONVERSATION_INIT_FAILED" });
        removeBatchFromQueue();
        return;
      }

      callbacksRef.current.onConversationResolved?.(targetConvId);

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
            if (isStale()) {
              if (!isUnmountedRef.current) useFileStore.getState().removeFromQueue(item.tempId);
              return;
            }
            if (uploadedFile) {
              const normalizedFile: FileItem = uploadedFile.conversation_id
                ? uploadedFile
                : { ...uploadedFile, conversation_id: targetConvId };
              useFileStore.getState().completeUpload(item.tempId, normalizedFile);
              callbacksRef.current.onUploadComplete?.(normalizedFile);
              scheduleManagedTimeout(
                () => useFileStore.getState().clearRecentlyCompleted(normalizedFile.id),
                RECENTLY_COMPLETED_TTL_MS
              );
            } else {
              logger.error(
                "[useFileUpload] Upload returned HTTP 200 without file payload:",
                item.filename
              );
              callbacksRef.current.onError?.({ code: "UPLOAD_FAILED", filename: item.filename });
              useFileStore.getState().removeFromQueue(item.tempId);
            }
          },
        });

        if (result.outcome === "stale") {
          if (!isUnmountedRef.current) useFileStore.getState().removeFromQueue(item.tempId);
          break;
        }
        if (result.outcome === "cancelled") {
          cancelledTempIdsRef.current.delete(item.tempId);
          useFileStore.getState().removeFromQueue(item.tempId);
          continue;
        }
        if (result.outcome === "error") {
          logger.error("[useFileUpload] File upload failed:", result.error);
          // Notify onError BEFORE setStatus("error") so pending-send cancels before isUploadBusy drops
          callbacksRef.current.onError?.(result.error);
          useFileStore
            .getState()
            .setStatus(item.tempId, "error", result.error.detail || result.error.code);
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

  const { isDragging } = useGlobalFileDropPaste({ disabled, onFiles: uploadFiles });

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    const isSelfInitiated = isSelfInitiatedUploadRef?.current ?? false;
    if (shouldClearQueue(prevId, conversationId, isSelfInitiated)) {
      cancelActiveUploads();
      useFileStore.getState().clearQueue();
      callbacksRef.current.onSessionReset?.();
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
    isPreparingUpload,
    isUploadBusy: isPreparingUpload || isUploading,
    activeUploadCount,
  };
}
