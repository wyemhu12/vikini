/**
 * useFileUpload - Unified upload logic hook (picker, global drag & drop, paste, XHR progress).
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { shouldClearQueue } from "@/lib/features/chat/draftConversation";
import type { FileItem, FileUploadProgress } from "@/types/files";
import { useFileStore } from "./store";
import {
  classifyClientSide,
  FILE_ACCEPT,
  sendFileUploadXhr,
  StructuredUploadError,
  UPLOAD_ABORTED_SENTINEL,
  validateFileForUpload,
  type FileUploadError,
} from "./fileUploadHelpers";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

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
  const isUploading = useFileStore((s) => s.uploadQueue.some((q) => q.status === "uploading"));

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
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const sleepResolversRef = useRef<Set<() => void>>(new Set());

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
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
    for (const resolveSleep of sleepResolversRef.current) resolveSleep();
    sleepResolversRef.current.clear();
    for (const xhr of activeXhrsRef.current) {
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
    };
  }, [cancelActiveUploads]);

  const scheduleManagedTimeout = useCallback((fn: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      if (!isUnmountedRef.current) fn();
    }, delayMs);
    timersRef.current.add(timer);
  }, []);

  const abortableSleep = useCallback((delayMs: number): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        sleepResolversRef.current.delete(done);
        clearTimeout(timer);
        timersRef.current.delete(timer);
        resolve();
      };
      const timer = setTimeout(done, delayMs);
      timersRef.current.add(timer);
      sleepResolversRef.current.add(done);
    });
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

      for (const file of fileArray) {
        if (isStale()) break;
        const validationError = validateFileForUpload(file);
        if (validationError) {
          logger.warn("[useFileUpload] File rejected by client validation:", validationError);
          onErrorRef.current?.(validationError);
          continue;
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() || "" : "";
        const tempId = crypto.randomUUID();
        const queueItem: FileUploadProgress = {
          tempId,
          file,
          filename: file.name,
          size: file.size,
          kind: classifyClientSide(ext, file.type),
          progress: 0,
          status: "uploading",
        };
        useFileStore.getState().addToQueue(queueItem);

        let lastError: FileUploadError | null = null;
        let wasAborted = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (isStale()) {
            wasAborted = true;
            break;
          }
          if (attempt > 0) {
            logger.info(
              `[useFileUpload] Retrying upload for ${file.name} (attempt ${attempt + 1})`
            );
            useFileStore.getState().updateProgress(tempId, 0);
            await abortableSleep(RETRY_DELAY_MS);
            if (isStale()) {
              wasAborted = true;
              break;
            }
          }

          try {
            await sendFileUploadXhr({
              file,
              conversationId: targetConvId,
              activeXhrs: activeXhrsRef.current,
              onProgress: (pct) => {
                if (!isUnmountedRef.current) useFileStore.getState().updateProgress(tempId, pct);
              },
              onSuccess: (uploadedFile) => {
                useFileStore.getState().setStatus(tempId, "ready");
                if (uploadedFile && !isUnmountedRef.current) {
                  onUploadCompleteRef.current?.(uploadedFile);
                }
                scheduleManagedTimeout(() => useFileStore.getState().removeFromQueue(tempId), 800);
              },
            });
            lastError = null;
            break;
          } catch (attemptErr: unknown) {
            if (attemptErr instanceof Error && attemptErr.message === UPLOAD_ABORTED_SENTINEL) {
              wasAborted = true;
              break;
            }
            const structured =
              attemptErr instanceof StructuredUploadError
                ? attemptErr
                : new StructuredUploadError({ code: "UPLOAD_FAILED", filename: file.name }, false);
            lastError = structured.uploadError;
            if (!structured.retryable || attempt >= MAX_RETRIES) break;
          }
        }

        if (wasAborted || isStale()) {
          useFileStore.getState().removeFromQueue(tempId);
          break;
        }
        if (lastError) {
          logger.error("[useFileUpload] File upload failed:", lastError);
          useFileStore.getState().setStatus(tempId, "error", lastError.detail || lastError.code);
          onErrorRef.current?.(lastError);
          scheduleManagedTimeout(() => useFileStore.getState().removeFromQueue(tempId), 5000);
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
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        const isScreenshot = file.name === "image.png" || file.name.startsWith("blob");
        pastedFiles.push(
          isScreenshot
            ? new File([file], `screenshot-${Date.now()}.${file.name.split(".").pop() || "png"}`, {
                type: file.type,
              })
            : file
        );
      }
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
    isDragging,
    fileInputRef,
    fileAccept: FILE_ACCEPT,
    handleFileInputChange,
    isUploading,
  };
}
