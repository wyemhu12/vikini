// /app/features/chat/components/InputForm.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useFileUpload } from "@/lib/features/files/useFileUpload";
import { sortComposerFiles } from "@/lib/features/files/uploadPresentation";
import { useFiles } from "@/lib/features/files/useFiles";
import { useFileStore } from "@/lib/features/files/store";
import { FilePreviewArea } from "./FilePreviewArea";
import { PendingUploadSendBanner } from "./PendingUploadSendBanner";
import { ComposerSubmitButton } from "./ComposerSubmitButton";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { VoiceButton } from "./VoiceButton";
import { useLanguage } from "../hooks/useLanguage";
import { useComposerFileActions } from "./hooks/useComposerFileActions";
import { usePendingUploadSend, type PendingSendBridge } from "./hooks/usePendingUploadSend";
import type { FileItem } from "@/types/files";

const FileLightbox = dynamic(() => import("./FileLightbox"), { ssr: false });

interface InputFormProps {
  input: string;
  onChangeInput: (value: string) => void;
  onSubmit: (fileIds?: string[]) => void;
  onStop?: () => void;
  onImageGen?: (prompt: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  conversationId?: string | null;
  initialImageMode?: boolean;
  onImageModeConsumed?: () => void;
  isPreview?: boolean;
  /** File IDs already referenced in sent messages (from message meta, survives reload) */
  sentMessageFileIds?: string[];
  /** Optional function to ensure conversation exists before uploading (for New Chat mode) */
  ensureConversationId?: () => Promise<string>;
  /** Optional ref indicating upload was initiated from the current UI */
  isSelfInitiatedUploadRef?: React.MutableRefObject<boolean>;
  /** Composer-level controls (model / thinking) rendered right-aligned before Mic/Send. */
  trailingControls?: React.ReactNode;
  /** Toggles / chips rendered right after the "+" button (hidden in image mode). */
  renderLeadingControls?: (api: ComposerApi) => React.ReactNode;
}

/** Composer actions exposed to leading controls (e.g. the mobile options sheet). */
export interface ComposerApi {
  openFilePicker: () => void;
  attachDisabled: boolean;
}

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  onStop,
  onImageGen,
  disabled,
  isStreaming,
  conversationId,
  initialImageMode = false,
  onImageModeConsumed,
  isPreview = false,
  sentMessageFileIds = [],
  ensureConversationId,
  isSelfInitiatedUploadRef,
  trailingControls,
  renderLeadingControls,
}: InputFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageMode, setIsImageMode] = useState(initialImageMode);
  const [isFocused, setIsFocused] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const { t, language } = useLanguage();

  // === Unified file management & Queue-to-Send bridge ===
  const { files: allFiles, mutate } = useFiles(conversationId ?? null);
  const uploadQueue = useFileStore((s) => s.uploadQueue);
  const sentFileIds = useFileStore((s) => s.sentFileIds);
  const markAsSent = useFileStore((s) => s.markAsSent);
  const clearSentFileIds = useFileStore((s) => s.clearSentFileIds);
  const releaseFileMetadata = useFileStore((s) => s.releaseFileMetadata);
  const pendingSendBridgeRef = useRef<PendingSendBridge | null>(null);

  const allSentFileIds = useMemo(
    () => [...new Set([...sentMessageFileIds, ...sentFileIds])],
    [sentMessageFileIds, sentFileIds]
  );

  // Filter out files already sent & sort chronologically ascending (oldest left, newest right)
  // so in-place upload completions never teleport on SWR revalidation.
  const files = useMemo(() => {
    const allSent = new Set(allSentFileIds);
    return sortComposerFiles(allFiles.filter((f) => !allSent.has(f.id)));
  }, [allFiles, allSentFileIds]);
  const fileCount = files.length;

  const {
    handleUploadComplete,
    handleUploadError,
    handleConversationResolved,
    handleSessionReset,
    handleRemoveFile,
    handleClearAll,
  } = useComposerFileActions({
    conversationId: conversationId ?? null,
    files,
    mutate,
    releaseFileMetadata,
    clearSentFileIds,
    bridgeRef: pendingSendBridgeRef,
    t,
  });

  const {
    openFilePicker,
    cancelUpload,
    dismissUploadError,
    isDragging,
    fileInputRef,
    fileAccept,
    handleFileInputChange,
    isUploading,
    isPreparingUpload,
    isUploadBusy,
    activeUploadCount,
  } = useFileUpload({
    conversationId: conversationId ?? null,
    disabled: Boolean(disabled),
    ensureConversationId,
    isSelfInitiatedUploadRef,
    onUploadComplete: handleUploadComplete,
    onError: handleUploadError,
    onConversationResolved: handleConversationResolved,
    onSessionReset: handleSessionReset,
  });

  const effectiveUploadBusy = isUploadBusy ?? (Boolean(isPreparingUpload) || isUploading);
  const effectiveUploadCount = activeUploadCount ?? (effectiveUploadBusy ? 1 : 0);

  const dispatchSend = useCallback(
    (fileIds: string[]) => {
      if (fileIds.length > 0) markAsSent(fileIds);
      onSubmit(fileIds.length > 0 ? fileIds : undefined);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    [markAsSent, onSubmit]
  );

  const handleCancelledByError = useCallback(() => {
    toast.info(t("pendingSendCancelledOnError"));
  }, [t]);

  const { isPendingSend, queuePendingSend, cancelPendingSend, consumeMergedFileIds } =
    usePendingUploadSend({
      input,
      files,
      sentFileIds: allSentFileIds,
      conversationId: conversationId ?? null,
      isUploadBusy: effectiveUploadBusy,
      disabled: Boolean(disabled),
      isStreaming: Boolean(isStreaming),
      isImageMode,
      escapeDisabled: Boolean(lightboxFile),
      bridgeRef: pendingSendBridgeRef,
      onFlushSend: dispatchSend,
      onConversationSwitch: clearSentFileIds,
      onCancelledByError: handleCancelledByError,
    });

  const handleCancelUpload = useCallback(
    (tempId: string) => {
      cancelPendingSend();
      cancelUpload(tempId);
    },
    [cancelPendingSend, cancelUpload]
  );

  const handleFinalTranscript = useCallback(
    (text: string) => {
      cancelPendingSend();
      const next = inputRef.current ? `${inputRef.current} ${text}` : text;
      inputRef.current = next;
      onChangeInput(next);
    },
    [cancelPendingSend, onChangeInput]
  );

  // Sync initialImageMode prop
  useEffect(() => {
    if (initialImageMode) {
      setIsImageMode(true);
      onImageModeConsumed?.();
    }
  }, [initialImageMode, onImageModeConsumed]);

  // Auto resize textarea (skip when empty or during hover preview to prevent Landing layout oscillation)
  useEffect(() => {
    if (!textareaRef.current) return;
    if (isPreview || !input) {
      textareaRef.current.style.height = "";
      return;
    }
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [input, isPreview]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Bỏ qua nếu đang gõ tiếng Việt Telex / IME CJK composition hoặc Safari keyCode 229 (m-9)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === "Enter" && !e.shiftKey) {
      if (window.innerWidth >= 768) {
        e.preventDefault();
        if (isStreaming) return; // Chặn Enter khi đang stream
        handleSubmit();
      }
    }
  };

  // Ref to prevent double-submit in same tick/race conditions
  const isSubmittingRef = useRef(false);

  // Reset isSubmittingRef when streaming completes or conversation changes
  useEffect(() => {
    isSubmittingRef.current = false;
  }, [conversationId, isStreaming]);

  const hasPromptText = Boolean(input.trim());

  const handleSubmit = () => {
    if (disabled || isSubmittingRef.current || isStreaming) return;

    if (isImageMode && onImageGen) {
      if (hasPromptText) {
        isSubmittingRef.current = true;
        onImageGen(input);
        onChangeInput("");
        setIsImageMode(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        requestAnimationFrame(() => {
          isSubmittingRef.current = false;
        });
      }
      return;
    }

    if (effectiveUploadBusy) {
      if (hasPromptText && !isPendingSend) {
        queuePendingSend();
      }
      return;
    }

    if (hasPromptText || fileCount > 0) {
      isSubmittingRef.current = true;
      dispatchSend(consumeMergedFileIds());
      requestAnimationFrame(() => {
        isSubmittingRef.current = false;
      });
    }
  };

  // Smart Send/Stop button state machine (Queue-to-Send requires prompt text when uploading)
  const isReady =
    !disabled &&
    (isImageMode
      ? hasPromptText
      : effectiveUploadBusy
        ? hasPromptText
        : hasPromptText || fileCount > 0);

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          if (isStreaming) {
            onStop?.();
          } else {
            handleSubmit();
          }
        }}
        className={`relative flex flex-col w-full rounded-3xl border shadow-(--shadow-elevated) transition-[border-color,box-shadow,background-color] duration-200 ${
          isImageMode
            ? "bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] border-(--accent) ring-1 ring-(--accent)/50"
            : isDragging
              ? "bg-[color-mix(in_srgb,var(--accent)_6%,var(--raised))] border-(--accent) ring-2 ring-(--accent)/40"
              : "bg-(--raised) border-(--line) focus-within:border-(--accent) focus-within:ring-1 focus-within:ring-(--accent)/30"
        }`}
      >
        {isStreaming && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-px inset-x-6 h-0.5 overflow-hidden rounded-full bg-(--accent)/15"
          >
            <div
              aria-hidden="true"
              data-testid="composer-stream-line"
              className="h-full w-2/5 rounded-full bg-(--accent) animate-vikini-shimmer motion-reduce:animate-none"
            />
          </div>
        )}

        {/* Inline File Preview Area (replaces AttachmentsPanel + FileChips) */}
        <FilePreviewArea
          files={files}
          uploadQueue={uploadQueue}
          onRemoveFile={handleRemoveFile}
          onCancelUpload={handleCancelUpload}
          onDismissError={dismissUploadError}
          onClearAll={handleClearAll}
          onClickFile={setLightboxFile}
          isDragging={isDragging}
          disabled={disabled}
        />

        {/* Queued auto-send indicator while files finish uploading */}
        <PendingUploadSendBanner
          visible={isPendingSend && !isStreaming && !isImageMode}
          activeUploadCount={effectiveUploadCount}
          onCancel={cancelPendingSend}
        />

        {/* Input row: always 2 rows (Row 1: full-width textarea; Row 2: [+] left, model/thinking/mic/send right) */}
        <div
          className={`flex flex-wrap items-end gap-2 p-2 ${fileCount > 0 || uploadQueue.length > 0 ? "pt-0" : ""}`}
        >
          {/* Text Area */}
          <div className="order-first basis-full min-w-0 relative">
            {isImageMode && (
              <div className="absolute -top-6 left-0 text-xs font-semibold text-(--accent) animate-in fade-in slide-in-from-bottom-1 bg-(--surface) px-2 py-0.5 rounded-full border border-(--accent)/30 shadow-sm">
                {t("imageModeLabel") || "Image generation mode"}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                cancelPendingSend();
                onChangeInput(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                isImageMode
                  ? t("imagePlaceholder") || "Describe the image you want to generate..."
                  : t("placeholder") || "Message..."
              }
              disabled={disabled}
              className={`max-h-[200px] min-h-[40px] h-10 w-full resize-none bg-transparent px-2 py-2 text-base md:text-[15px] placeholder:text-(--muted) outline-none scrollbar-thin scrollbar-thumb-(--line) border-0 focus-visible:ring-0 shadow-none ${isPreview ? "text-(--muted) italic overflow-hidden whitespace-nowrap text-ellipsis" : "text-(--text)"}`}
            />
          </div>

          <div className="flex w-full items-center gap-1 @sm/chat:gap-2 min-w-0">
            {/* Plus Menu Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform,filter] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] disabled:opacity-50 ${
                    isImageMode
                      ? "bg-(--accent) text-(--on-accent) hover:brightness-110"
                      : "text-(--muted) hover:bg-(--raised-hover) hover:text-(--text)"
                  }`}
                  title={t("addAttachment") || "Add..."}
                  aria-label={t("addAttachment") || "Add attachment or switch mode"}
                >
                  {isImageMode ? <ImageIcon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={openFilePicker}>
                  <Upload className="w-4 h-4 mr-2" />
                  {t("uploadFile") || "Upload File"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsImageMode(!isImageMode)}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {isImageMode
                    ? t("switchToChat") || "Switch to Chat"
                    : t("createImage") || "Create Image"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden file input - controlled by useFileUpload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              multiple
              accept={fileAccept}
              aria-label={t("uploadFile") || "Upload file"}
            />

            {!isImageMode &&
              renderLeadingControls?.({
                openFilePicker,
                attachDisabled: Boolean(disabled),
              })}

            <div className="flex items-center gap-1 @sm/chat:gap-1.5 ml-auto min-w-0">
              {!isImageMode && trailingControls}

              {isImageMode && (
                <button
                  type="button"
                  onClick={() => setIsImageMode(false)}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-(--muted) hover:bg-(--raised-hover) hover:text-(--danger) transition-[background-color,color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95]"
                  title={t("cancelImageMode") || "Cancel Image Mode"}
                  aria-label={t("cancelImageMode") || "Cancel image mode"}
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Voice Input Button */}
              {!isImageMode && (
                <VoiceButton
                  onFinalTranscript={handleFinalTranscript}
                  disabled={disabled || isStreaming}
                  language={language === "vi" ? "vi-VN" : "en-US"}
                />
              )}

              {/* Send / Stop / Pending-Send Cancel Button */}
              <ComposerSubmitButton
                isStreaming={Boolean(isStreaming)}
                isPendingSend={isPendingSend}
                isUploadBusy={effectiveUploadBusy}
                isImageMode={isImageMode}
                isReady={isReady}
                onCancelPendingSend={cancelPendingSend}
              />
            </div>
          </div>
        </div>

        {/* Keyboard shortcut hints */}
        {isFocused && (
          <div className="hidden md:flex items-center justify-end gap-3 px-4 pb-2 -mt-1 text-xs text-(--muted)/60 select-none animate-in fade-in duration-200">
            {isPendingSend ? (
              <span>Esc {t("pendingSendEscHint")}</span>
            ) : (
              <>
                <span>↵ {t("send") || "Send"}</span>
                <span>Shift+↵ {t("newLine") || "New line"}</span>
              </>
            )}
          </div>
        )}
      </form>

      {/* File Lightbox */}
      {lightboxFile && (
        <FileLightbox
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
          files={files}
          onNavigate={setLightboxFile}
        />
      )}
    </>
  );
}
