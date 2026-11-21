/**
 * usePendingUploadSend - Queue-to-Send state machine for chat composer uploads.
 *
 * When a user submits a prompt while files are preparing or uploading, arms `isPendingSend`
 * and automatically dispatches once all uploads settle and `conversationId` matches
 * `expectedConversationId`, merging SWR files with synchronously completed upload IDs.
 */

"use client";

import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  isPendingSendReadyToFlush,
  mergeDispatchFileIds,
} from "@/lib/features/files/uploadPresentation";
import type { FileItem } from "@/types/files";

export interface PendingSendBridge {
  recordCompletedUpload: (file: FileItem) => void;
  handleConversationResolved: (convId: string) => void;
  handleUploadFailure: () => void;
  resetForConversationChange: () => void;
  cancelPendingSend: () => void;
  forgetCompletedFile: (id: string) => void;
  clearCompletedFiles: () => void;
}

export interface UsePendingUploadSendOptions {
  input: string;
  files: readonly FileItem[];
  sentFileIds: readonly string[];
  conversationId: string | null;
  isUploadBusy: boolean;
  disabled: boolean;
  isStreaming: boolean;
  isImageMode: boolean;
  escapeDisabled?: boolean;
  bridgeRef?: MutableRefObject<PendingSendBridge | null>;
  onFlushSend: (mergedFileIds: string[]) => void;
  onConversationSwitch?: () => void;
  onCancelledByError?: () => void;
}

export function usePendingUploadSend({
  input,
  files,
  sentFileIds,
  conversationId,
  isUploadBusy,
  disabled,
  isStreaming,
  isImageMode,
  escapeDisabled = false,
  bridgeRef,
  onFlushSend,
  onConversationSwitch,
  onCancelledByError,
}: UsePendingUploadSendOptions) {
  const [isPendingSend, setIsPendingSend] = useState(false);
  const isPendingSendRef = useRef(false);
  const recentCompletedIdsRef = useRef<string[]>([]);
  const expectedConversationIdRef = useRef<string | null>(null);
  const prevInputRef = useRef(input);
  const prevConversationIdRef = useRef<string | null>(conversationId);
  const filesRef = useRef(files);
  const sentFileIdsRef = useRef(sentFileIds);
  const onFlushSendRef = useRef(onFlushSend);
  const onConversationSwitchRef = useRef(onConversationSwitch);
  const onCancelledByErrorRef = useRef(onCancelledByError);
  const isUnmountedRef = useRef(false);

  const hasPromptText = Boolean(input.trim());

  useEffect(() => {
    filesRef.current = files;
    sentFileIdsRef.current = sentFileIds;
    onFlushSendRef.current = onFlushSend;
    onConversationSwitchRef.current = onConversationSwitch;
    onCancelledByErrorRef.current = onCancelledByError;
  }, [files, sentFileIds, onFlushSend, onConversationSwitch, onCancelledByError]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      isPendingSendRef.current = false;
      recentCompletedIdsRef.current = [];
      expectedConversationIdRef.current = null;
    };
  }, []);

  const cancelPendingSend = useCallback(() => {
    if (!isPendingSendRef.current) return;
    isPendingSendRef.current = false;
    if (!isUnmountedRef.current) setIsPendingSend(false);
  }, []);

  const queuePendingSend = useCallback(() => {
    if (!hasPromptText || disabled || isStreaming || isImageMode || isPendingSendRef.current) {
      return false;
    }
    isPendingSendRef.current = true;
    setIsPendingSend(true);
    return true;
  }, [disabled, hasPromptText, isImageMode, isStreaming]);

  const recordCompletedUpload = useCallback((file: FileItem) => {
    if (!recentCompletedIdsRef.current.includes(file.id)) {
      recentCompletedIdsRef.current = [...recentCompletedIdsRef.current, file.id];
    }
    if (file.conversation_id) {
      expectedConversationIdRef.current = file.conversation_id;
    }
  }, []);

  const handleConversationResolved = useCallback((convId: string) => {
    expectedConversationIdRef.current = convId;
  }, []);

  const forgetCompletedFile = useCallback((fileId: string) => {
    recentCompletedIdsRef.current = recentCompletedIdsRef.current.filter((id) => id !== fileId);
  }, []);

  const clearCompletedFiles = useCallback(() => {
    recentCompletedIdsRef.current = [];
    expectedConversationIdRef.current = null;
  }, []);

  const resetForConversationChange = useCallback(() => {
    isPendingSendRef.current = false;
    if (!isUnmountedRef.current) setIsPendingSend(false);
    recentCompletedIdsRef.current = [];
    expectedConversationIdRef.current = null;
  }, []);

  const handleUploadFailure = useCallback(() => {
    if (!isPendingSendRef.current) return;
    isPendingSendRef.current = false;
    if (!isUnmountedRef.current) setIsPendingSend(false);
    onCancelledByErrorRef.current?.();
  }, []);

  const consumeMergedFileIds = useCallback(() => {
    const merged = mergeDispatchFileIds(
      filesRef.current,
      recentCompletedIdsRef.current,
      sentFileIdsRef.current
    );
    recentCompletedIdsRef.current = [];
    expectedConversationIdRef.current = null;
    return merged;
  }, []);

  useEffect(() => {
    if (!bridgeRef) return;
    bridgeRef.current = {
      recordCompletedUpload,
      handleConversationResolved,
      handleUploadFailure,
      resetForConversationChange,
      cancelPendingSend,
      forgetCompletedFile,
      clearCompletedFiles,
    };
  }, [
    bridgeRef,
    recordCompletedUpload,
    handleConversationResolved,
    handleUploadFailure,
    resetForConversationChange,
    cancelPendingSend,
    forgetCompletedFile,
    clearCompletedFiles,
  ]);

  // === Cancel effects MUST be declared BEFORE the auto-flush effect so cancel always wins ===

  // 1. Cancel pending send if input changes (typed edit, voice transcript, or external prompt select)
  useEffect(() => {
    if (prevInputRef.current !== input) {
      prevInputRef.current = input;
      if (isPendingSendRef.current) {
        isPendingSendRef.current = false;
        setIsPendingSend(false);
      }
    }
  }, [input]);

  // 2. Cancel & reset on real conversation switch (NEVER on New Chat promotion null -> conv-new)
  useEffect(() => {
    const prevConvId = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;
    if (prevConvId !== null && prevConvId !== conversationId) {
      isPendingSendRef.current = false;
      setIsPendingSend(false);
      recentCompletedIdsRef.current = [];
      expectedConversationIdRef.current = null;
      onConversationSwitchRef.current?.();
    }
  }, [conversationId]);

  // 3. Cancel pending send if composer becomes disabled, enters streaming/image mode, or loses prompt text
  useEffect(() => {
    if ((disabled || isStreaming || isImageMode || !hasPromptText) && isPendingSendRef.current) {
      isPendingSendRef.current = false;
      setIsPendingSend(false);
    }
  }, [disabled, isStreaming, isImageMode, hasPromptText]);

  // 4. Escape key cancels pending send unless a modal/lightbox or IME owns Escape
  useEffect(() => {
    if (!isPendingSend || escapeDisabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      cancelPendingSend();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPendingSend, escapeDisabled, cancelPendingSend]);

  // 5. Auto-flush effect (DECLARED LAST with synchronous ref guard so cancels always win)
  useEffect(() => {
    if (isUnmountedRef.current || !isPendingSendRef.current) return;
    const ready = isPendingSendReadyToFlush({
      isPendingSend,
      isUploadBusy,
      disabled,
      isStreaming,
      isImageMode,
      expectedConversationId: expectedConversationIdRef.current,
      currentConversationId: conversationId,
      hasPromptText,
    });
    if (!ready) return;

    isPendingSendRef.current = false;
    setIsPendingSend(false);
    const mergedFileIds = consumeMergedFileIds();
    onFlushSendRef.current(mergedFileIds);
  }, [
    isPendingSend,
    isUploadBusy,
    disabled,
    isStreaming,
    isImageMode,
    conversationId,
    hasPromptText,
    consumeMergedFileIds,
  ]);

  return {
    isPendingSend,
    queuePendingSend,
    cancelPendingSend,
    recordCompletedUpload,
    forgetCompletedFile,
    clearCompletedFiles,
    handleConversationResolved,
    handleUploadFailure,
    resetForConversationChange,
    consumeMergedFileIds,
  };
}
