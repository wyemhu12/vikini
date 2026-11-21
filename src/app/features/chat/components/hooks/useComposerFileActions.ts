/**
 * useComposerFileActions - File completion SWR merge and deletion actions for InputForm.
 */

"use client";

import { type MutableRefObject, useCallback, useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import type { FileUploadError } from "@/lib/features/files/fileUploadHelpers";
import {
  formatFileUploadError,
  mergeUploadedFileOptimistically,
} from "@/lib/features/files/uploadPresentation";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import type { FileItem } from "@/types/files";
import type { PendingSendBridge } from "./usePendingUploadSend";

interface UseComposerFileActionsOptions {
  conversationId: string | null;
  files: readonly FileItem[];
  mutate: (
    data?:
      | FileItem[]
      | Promise<FileItem[] | undefined>
      | ((current?: FileItem[]) => FileItem[] | undefined),
    opts?: { revalidate?: boolean }
  ) => Promise<FileItem[] | undefined>;
  releaseFileMetadata: (id: string) => void;
  clearSentFileIds?: () => void;
  bridgeRef?: MutableRefObject<PendingSendBridge | null>;
  onFileCompleted?: (file: FileItem) => void;
  onFileRemoved?: (id: string) => void;
  onFilesCleared?: () => void;
  onUploadFailure?: () => void;
  t: (key: string) => string;
}

export function useComposerFileActions({
  conversationId,
  files,
  mutate,
  releaseFileMetadata,
  clearSentFileIds,
  bridgeRef,
  onFileCompleted,
  onFileRemoved,
  onFilesCleared,
  onUploadFailure,
  t,
}: UseComposerFileActionsOptions) {
  const { mutate: globalMutate } = useSWRConfig();
  const onFileCompletedRef = useRef(onFileCompleted);
  const onFileRemovedRef = useRef(onFileRemoved);
  const onFilesClearedRef = useRef(onFilesCleared);
  const onUploadFailureRef = useRef(onUploadFailure);

  useEffect(() => {
    onFileCompletedRef.current = onFileCompleted;
    onFileRemovedRef.current = onFileRemoved;
    onFilesClearedRef.current = onFilesCleared;
    onUploadFailureRef.current = onUploadFailure;
  }, [onFileCompleted, onFileRemoved, onFilesCleared, onUploadFailure]);

  const handleUploadError = useCallback(
    (err: FileUploadError) => {
      toast.error(formatFileUploadError(err, t));
      bridgeRef?.current?.handleUploadFailure();
      onUploadFailureRef.current?.();
    },
    [bridgeRef, t]
  );

  const handleConversationResolved = useCallback(
    (convId: string) => {
      bridgeRef?.current?.handleConversationResolved(convId);
    },
    [bridgeRef]
  );

  const handleSessionReset = useCallback(() => {
    clearSentFileIds?.();
    bridgeRef?.current?.resetForConversationChange();
  }, [bridgeRef, clearSentFileIds]);

  const handleUploadComplete = useCallback(
    (uploadedFile: FileItem) => {
      bridgeRef?.current?.recordCompletedUpload(uploadedFile);
      onFileCompletedRef.current?.(uploadedFile);
      const fileConvId = uploadedFile.conversation_id;
      if (conversationId && (!fileConvId || fileConvId === conversationId)) {
        void mutate((current) => mergeUploadedFileOptimistically(current, uploadedFile), {
          revalidate: true,
        });
      } else if (fileConvId) {
        // New Chat race fallback: SWR key may still be null while ensureConversationId just resolved
        void globalMutate<FileItem[]>(
          `/api/files?conversationId=${fileConvId}`,
          (current) => mergeUploadedFileOptimistically(current, uploadedFile),
          { revalidate: true }
        );
      }
    },
    [bridgeRef, conversationId, globalMutate, mutate]
  );

  const handleRemoveFile = useCallback(
    async (id: string) => {
      bridgeRef?.current?.cancelPendingSend();
      bridgeRef?.current?.forgetCompletedFile(id);
      onFileRemovedRef.current?.(id);
      try {
        const res = await fetch(`/api/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        releaseFileMetadata(id);
        void mutate();
      } catch (err: unknown) {
        logger.error("[InputForm] Failed to remove file:", err);
        toast.error(t("deleteFileFailed"));
      }
    },
    [bridgeRef, mutate, releaseFileMetadata, t]
  );

  const handleClearAll = useCallback(async () => {
    if (files.length === 0) return;
    bridgeRef?.current?.cancelPendingSend();
    bridgeRef?.current?.clearCompletedFiles();
    onFilesClearedRef.current?.();
    let failedCount = 0;
    for (const f of files) {
      try {
        const res = await fetch(`/api/files?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
        if (!res.ok) {
          failedCount += 1;
          logger.error(`[InputForm] Failed to delete file ${f.id}: HTTP ${res.status}`);
        } else {
          releaseFileMetadata(f.id);
        }
      } catch (err: unknown) {
        failedCount += 1;
        logger.error(`[InputForm] Network error deleting file ${f.id}:`, err);
      }
    }
    void mutate();
    if (failedCount > 0) {
      toast.error(
        t("clearFilesPartialFailed")
          .replace("{failed}", String(failedCount))
          .replace("{total}", String(files.length))
      );
    } else {
      toast.success(t("filesCleared").replace("{count}", String(files.length)));
    }
  }, [bridgeRef, files, mutate, releaseFileMetadata, t]);

  return {
    handleUploadComplete,
    handleUploadError,
    handleConversationResolved,
    handleSessionReset,
    handleRemoveFile,
    handleClearAll,
  };
}
