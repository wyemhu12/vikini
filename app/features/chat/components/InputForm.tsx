// /app/features/chat/components/InputForm.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAttachmentStore } from "@/lib/features/attachments/store";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Image as ImageIcon, Upload, X, Loader2 } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { useDebounceCallback } from "@/lib/hooks/useDebounceCallback";
import { VoiceButton } from "./VoiceButton";

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
  onSubmit: () => void;
  onStop?: () => void;
  onImageGen?: (prompt: string) => void; // New prop
  disabled?: boolean;
  isStreaming?: boolean;
  t?: Record<string, string>;
  conversationId?: string | null;
  initialImageMode?: boolean; // For remix from Gallery
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
}: InputFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAttachment, attachments } = useAttachmentStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isImageMode, setIsImageMode] = useState(initialImageMode);
  const [_voiceTranscript, setVoiceTranscript] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Sync initialImageMode prop to state (for Gallery remix)
  useEffect(() => {
    if (initialImageMode) {
      setIsImageMode(true);
    }
  }, [initialImageMode]);

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

  /*
   * Debounce submit to prevent accidental double-clicks or rapid-fire submissions.
   * 500ms delay ensures user intent and reduces server load.
   */
  const debouncedSubmit = useDebounceCallback(() => {
    onSubmit();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, 500);

  const handleSubmit = () => {
    if (disabled) return;

    if (isImageMode && onImageGen) {
      if (input.trim()) {
        onImageGen(input);
        setIsImageMode(false); // Exit mode after send
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    } else {
      if (input.trim() || attachments.length > 0) {
        // Use debounced submit for regular messages
        debouncedSubmit();
      }
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const f of files) {
        if (!conversationId) {
          logger.warn("No conversation ID for upload yet");
          continue;
        }

        const signRes = await fetch("/api/attachments/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            filename: f.name,
            fileType: f.type,
            fileSize: f.size,
          }),
        });

        const json = await signRes.json().catch(() => ({}));
        if (!signRes.ok) {
          throw new Error(json?.error?.message || json?.error || "Upload init failed");
        }

        const { signedUrl, path, filename, mimeType } = json.data || json;

        if (!signedUrl) throw new Error("Missing signed URL");

        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: f,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          logger.error("Upload response error:", {
            status: uploadRes.status,
            statusText: uploadRes.statusText,
            body: errorText,
          });
          throw new Error(
            `Storage upload failed: ${uploadRes.statusText} - ${errorText.substring(0, 100)}`
          );
        }

        const completeRes = await fetch("/api/attachments/complete-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            path,
            filename,
            sizeBytes: f.size,
            mimeType,
          }),
        });

        const completeJson = await completeRes.json().catch(() => ({}));
        if (!completeRes.ok) {
          throw new Error(
            completeJson?.error?.message || completeJson?.error || "Upload completion failed"
          );
        }

        if (completeJson.data?.attachment || completeJson?.attachment) {
          addAttachment(completeJson.data?.attachment || completeJson?.attachment);
        }
      }

      // Notify other components (like AttachmentsPanel) to refresh
      if (conversationId) {
        window.dispatchEvent(
          new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
        );
      }
    } catch (err) {
      logger.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : t?.error || "Upload failed";
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  // Global Paste Handler
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (disabled || isUploading) return;

      // Identify if we have interaction with another input/textarea (except our own)
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        !formRef.current?.contains(target)
      ) {
        return; // Don't interfere with other inputs
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            // Fix for screenshots having generic "image" name or missing extension
            if (
              file.type.startsWith("image/") &&
              (file.name === "image" || !file.name.includes("."))
            ) {
              const ext = file.type.split("/")[1] || "png";
              const newName = `screenshot-${Date.now()}.${ext}`;
              files.push(new File([file], newName, { type: file.type }));
            } else {
              files.push(file);
            }
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        await uploadFiles(files);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [disabled, isUploading]); // Dependencies

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Verify we're actually leaving the form, not just entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    setIsDragging(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  return (
    <form
      ref={formRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onSubmit={(e) => {
        e.preventDefault();
        if (isStreaming) {
          onStop?.();
        } else {
          handleSubmit();
        }
      }}
      className={`relative flex w-full items-end gap-2 rounded-3xl border p-2 shadow-2xl transition-all duration-300 ${
        isImageMode
          ? "bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] border-(--accent) ring-1 ring-(--accent)/50"
          : isDragging
            ? "bg-(--control-bg) border-(--accent) ring-2 ring-(--accent)/50 scale-[1.02]"
            : "bg-(--control-bg) border-(--control-border) focus-within:border-(--accent) focus-within:ring-1 focus-within:ring-(--accent)/30"
      }`}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-(--surface)/80 backdrop-blur-sm border-2 border-dashed border-(--accent)">
          <div className="flex flex-col items-center gap-2 text-(--accent) font-semibold animate-bounce">
            <Upload className="w-8 h-8" />
            <span>Drop files to upload</span>
          </div>
        </div>
      )}
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
            title="Add..."
            aria-label={t?.addAttachment || "Add attachment or switch mode"}
          >
            {isImageMode ? <ImageIcon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            {t?.uploadFile || "Upload File"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsImageMode(!isImageMode)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            {isImageMode ? "Switch to Chat" : "Create Image"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Loading Indicator */}
      {isUploading && (
        <div className="absolute left-[3.2rem] top-1/2 -translate-y-1/2 z-10 animate-fade-in">
          <Loader2 className="w-5 h-5 animate-spin text-(--accent)" />
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.sql,.sh,.yaml,.yml,.toml,.ini,.cfg,.log,.zip"
        aria-label={t?.uploadFile || "Upload file"}
      />

      {/* Text Area */}
      <div className="flex-1 min-w-0 relative">
        {isImageMode && (
          <div className="absolute -top-6 left-0 text-[10px] font-bold uppercase tracking-wider text-(--accent) animate-in fade-in slide-in-from-bottom-1 bg-(--surface-base) px-2 py-0.5 rounded-full border border-(--accent)/30 shadow-sm">
            IMAGE GENERATION MODE
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
              ? "Describe the image you want to generate..."
              : t?.placeholder || "Message..."
          }
          disabled={disabled}
          className="max-h-[200px] min-h-[40px] w-full resize-none bg-transparent py-2.5 text-[15px] text-(--text-primary) placeholder:text-(--text-secondary) outline-none scrollbar-thin scrollbar-thumb-[var(--control-border)] border-0 focus-visible:ring-0 shadow-none"
          style={{ height: "40px" }}
        />
      </div>

      {isImageMode && (
        <button
          type="button"
          onClick={() => setIsImageMode(false)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-red-500 transition-colors"
          title="Cancel Image Mode"
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
          !isStreaming &&
          ((!input.trim() && attachments.length === 0) || (disabled && !isUploading))
        }
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 shadow-lg ${
          !isStreaming &&
          ((!input.trim() && attachments.length === 0) || (disabled && !isUploading))
            ? "bg-(--control-bg) text-(--text-secondary) cursor-not-allowed"
            : isImageMode
              ? "bg-(--accent) text-white hover:brightness-110 shadow-[0_0_15px_var(--accent)]"
              : "bg-(--accent) text-(--surface) hover:brightness-110 active:scale-95 hover:shadow-[0_0_15px_var(--glow)]"
        }`}
        title={isStreaming ? "Stop" : t?.send || "Send"}
        aria-label={isStreaming ? t?.stop || "Stop generation" : t?.send || "Send message"}
      >
        {isStreaming ? (
          <StopIcon />
        ) : isImageMode ? (
          <ImageIcon className="w-5 h-5" />
        ) : (
          <PaperAirplaneIcon />
        )}
      </button>
    </form>
  );
}
