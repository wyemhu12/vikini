// /app/features/chat/components/InputForm.tsx
"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useFileUpload } from "@/lib/features/files/useFileUpload";
import { useFiles } from "@/lib/features/files/useFiles";
import { useFileStore } from "@/lib/features/files/store";
import { FilePreviewArea } from "./FilePreviewArea";
import { FileLightbox } from "./FileLightbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { useDebounceCallback } from "@/lib/hooks/useDebounceCallback";
import { VoiceButton } from "./VoiceButton";
import type { FileItem } from "@/types/files";

const PaperAirplaneIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-5 h-5"
  >
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

const StopIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-5 h-5"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

interface InputFormProps {
  input: string;
  onChangeInput: (value: string) => void;
  onSubmit: (fileIds?: string[]) => void;
  onStop?: () => void;
  onImageGen?: (prompt: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  t?: Record<string, string>;
  conversationId?: string | null;
  initialImageMode?: boolean;
  onImageModeConsumed?: () => void;
  isPreview?: boolean;
  /** File IDs already referenced in sent messages (from message meta, survives reload) */
  sentMessageFileIds?: string[];
}

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  onStop,
  onImageGen,
  disabled,
  isStreaming,
  t,
  conversationId,
  initialImageMode = false,
  onImageModeConsumed,
  isPreview = false,
  sentMessageFileIds = [],
}: InputFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isImageMode, setIsImageMode] = useState(initialImageMode);
  const [_voiceTranscript, setVoiceTranscript] = useState("");
  const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);

  // === Unified file management ===
  const { files: allFiles, mutate } = useFiles(conversationId ?? null);
  const uploadQueue = useFileStore((s) => s.uploadQueue);
  const sentFileIds = useFileStore((s) => s.sentFileIds);
  const markAsSent = useFileStore((s) => s.markAsSent);

  // Filter out files already sent — combine:
  // 1. sentMessageFileIds (from message meta, persistent/survives reload)
  // 2. sentFileIds (Zustand, optimistic/instant UI update before message is saved)
  const files = useMemo(() => {
    const allSent = new Set([...sentMessageFileIds, ...sentFileIds]);
    return allFiles.filter((f) => !allSent.has(f.id));
  }, [allFiles, sentMessageFileIds, sentFileIds]);
  const fileCount = files.length;
  const {
    openFilePicker,
    isDragging,
    fileInputRef,
    fileAccept,
    handleFileInputChange,
    isUploading,
  } = useFileUpload({
    conversationId: conversationId ?? null,
    disabled: disabled || false,
    onUploadComplete: (uploadedFile) => {
      // Optimistic SWR update: immediately add file to cache
      void mutate((current) => [...(current ?? []), uploadedFile], { revalidate: true });
    },
  });

  // === File removal ===
  const handleRemoveFile = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/files?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        void mutate();
      } catch {
        toast.error(t?.uploadFailed || "Failed to remove file");
      }
    },
    [mutate, t]
  );

  const handleClearAll = useCallback(async () => {
    try {
      for (const f of files) {
        await fetch(`/api/files?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
      }
      void mutate();
      toast.success(
        (t?.filesCleared || "{count} files cleared").replace("{count}", String(files.length))
      );
    } catch {
      toast.error(t?.uploadFailed || "Failed to clear files");
    }
  }, [files, mutate, t]);

  // Sync initialImageMode prop
  useEffect(() => {
    if (initialImageMode) {
      setIsImageMode(true);
      onImageModeConsumed?.();
    }
  }, [initialImageMode, onImageModeConsumed]);

  // Clear Zustand optimistic sentFileIds when switching conversations
  // (sentMessageFileIds from props handles the persistent/reload case)
  const clearSentFileIds = useFileStore((s) => s.clearSentFileIds);
  useEffect(() => {
    clearSentFileIds();
  }, [conversationId, clearSentFileIds]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (window.innerWidth >= 768) {
        e.preventDefault();
        handleSubmit();
      }
    }
  };

  // Ref to hold fileIds snapshot between handleSubmit (sync) and debouncedSubmit (async)
  const pendingFileIdsRef = useRef<string[]>([]);

  const debouncedSubmit = useDebounceCallback(() => {
    // Use fileIds snapshot from handleSubmit (files are already marked as sent)
    const fileIds = pendingFileIdsRef.current;
    pendingFileIdsRef.current = [];
    onSubmit(fileIds.length > 0 ? fileIds : undefined);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, 500);

  const handleSubmit = () => {
    if (disabled) return;

    if (isImageMode && onImageGen) {
      if (input.trim()) {
        onImageGen(input);
        onChangeInput("");
        setIsImageMode(false);
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    } else {
      if (input.trim() || fileCount > 0) {
        // Snapshot fileIds and mark as sent IMMEDIATELY (before debounce delay)
        const currentFileIds = files.map((f) => f.id);
        pendingFileIdsRef.current = currentFileIds;
        if (currentFileIds.length > 0) {
          markAsSent(currentFileIds);
        }
        debouncedSubmit();
      }
    }
  };

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
        className={`relative flex flex-col w-full rounded-3xl border shadow-2xl transition-[border-color,box-shadow] duration-300 ${
          isImageMode
            ? "bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] border-(--accent) ring-1 ring-(--accent)/50"
            : isDragging
              ? "bg-(--control-bg) border-(--accent) ring-2 ring-(--accent)/50 scale-[1.02]"
              : "bg-(--control-bg) border-(--control-border) focus-within:border-(--accent) focus-within:ring-1 focus-within:ring-(--accent)/30"
        }`}
      >
        {/* Inline File Preview Area (replaces AttachmentsPanel + FileChips) */}
        <FilePreviewArea
          files={files}
          uploadQueue={uploadQueue}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
          onClickFile={setLightboxFile}
          isDragging={isDragging}
          disabled={disabled || isUploading}
          t={t}
        />

        {/* Input row */}
        <div
          className={`flex items-end gap-2 p-2 ${fileCount > 0 || uploadQueue.length > 0 ? "pt-0" : ""}`}
        >
          {/* Plus Menu Trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={disabled || isUploading}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  isImageMode
                    ? "bg-(--accent) text-white hover:brightness-110"
                    : "text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary)"
                }`}
                title={t?.addAttachment || "Add..."}
                aria-label={t?.addAttachment || "Add attachment or switch mode"}
              >
                {isImageMode ? <ImageIcon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={openFilePicker}>
                <Upload className="w-4 h-4 mr-2" />
                {t?.uploadFile || "Upload File"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImageMode(!isImageMode)}>
                <ImageIcon className="w-4 h-4 mr-2" />
                {isImageMode
                  ? t?.switchToChat || "Switch to Chat"
                  : t?.createImage || "Create Image"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden file input — controlled by useFileUpload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
            multiple
            accept={fileAccept}
            aria-label={t?.uploadFile || "Upload file"}
          />

          {/* Text Area */}
          <div className="flex-1 min-w-0 relative">
            {isImageMode && (
              <div className="absolute -top-6 left-0 text-[10px] font-bold uppercase tracking-wider text-(--accent) animate-in fade-in slide-in-from-bottom-1 bg-(--surface-base) px-2 py-0.5 rounded-full border border-(--accent)/30 shadow-sm">
                {t?.imageModeLabel || "IMAGE GENERATION MODE"}
              </div>
            )}
            <Textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => onChangeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isImageMode
                  ? t?.imagePlaceholder || "Describe the image you want to generate..."
                  : t?.placeholder || "Message..."
              }
              disabled={disabled}
              className={`max-h-[200px] min-h-[40px] w-full resize-none bg-transparent py-2.5 text-[15px] placeholder:text-(--text-secondary) outline-none scrollbar-thin scrollbar-thumb-[var(--control-border)] border-0 focus-visible:ring-0 shadow-none ${isPreview ? "text-(--text-secondary) italic" : "text-(--text-primary)"}`}
              style={{ height: "40px" }}
            />
          </div>

          {isImageMode && (
            <button
              type="button"
              onClick={() => setIsImageMode(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--danger) transition-colors"
              title={t?.cancelImageMode || "Cancel Image Mode"}
              aria-label={t?.cancelImageMode || "Cancel image mode"}
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Voice Input Button */}
          {!isImageMode && (
            <VoiceButton
              onTranscript={setVoiceTranscript}
              onFinalTranscript={(text) => onChangeInput(input + (input ? " " : "") + text)}
              disabled={disabled || isStreaming}
              language="vi-VN"
              t={t}
            />
          )}

          {/* Send / Stop Button */}
          <button
            type="submit"
            disabled={
              !isStreaming && ((!input.trim() && fileCount === 0) || (disabled && !isUploading))
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[border-color,box-shadow] duration-200 shadow-lg ${
              !isStreaming && ((!input.trim() && fileCount === 0) || (disabled && !isUploading))
                ? "bg-(--control-bg) text-(--text-secondary) cursor-not-allowed"
                : isImageMode
                  ? "bg-(--accent) text-white hover:brightness-110 shadow-[0_0_15px_var(--accent)]"
                  : "bg-(--accent) text-(--surface) hover:brightness-110 active:scale-95 hover:shadow-[0_0_15px_var(--glow)]"
            }`}
            title={isStreaming ? t?.stopBtn || "Stop" : t?.send || "Send"}
            aria-label={
              isStreaming ? t?.stopGeneration || "Stop generation" : t?.send || "Send message"
            }
          >
            {isStreaming ? (
              <StopIcon />
            ) : isImageMode ? (
              <ImageIcon className="w-5 h-5" />
            ) : (
              <PaperAirplaneIcon />
            )}
          </button>
        </div>
      </form>

      {/* File Lightbox */}
      <FileLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />
    </>
  );
}
