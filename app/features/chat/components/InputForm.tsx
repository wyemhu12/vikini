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
import { Plus, Image as ImageIcon, Upload, X } from "lucide-react";

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
  t?: any;
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
        onSubmit();
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const f of files) {
        if (!conversationId) {
          console.warn("No conversation ID for upload yet");
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
          throw new Error(`Storage upload failed: ${uploadRes.statusText}`);
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
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : t?.error || "Upload failed";
      alert(errorMessage);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
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
      className={`relative flex w-full items-end gap-2 rounded-3xl border p-2 shadow-2xl transition-all duration-300 ${
        isImageMode
          ? "bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] border-[var(--accent)] ring-1 ring-[var(--accent)]/50"
          : "bg-[var(--control-bg)] border-[var(--control-border)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]/30"
      }`}
    >
      {/* Plus Menu Trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled || isUploading}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
              isImageMode
                ? "bg-[var(--accent)] text-white hover:brightness-110"
                : "text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)] hover:text-[var(--text-primary)]"
            }`}
            title="Add..."
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {/* Text Area */}
      <div className="flex-1 min-w-0 relative">
        {isImageMode && (
          <div className="absolute -top-6 left-0 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] animate-in fade-in slide-in-from-bottom-1 bg-[var(--surface-base)] px-2 py-0.5 rounded-full border border-[var(--accent)]/30 shadow-sm">
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
          className="max-h-[200px] min-h-[40px] w-full resize-none bg-transparent py-2.5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none scrollbar-thin scrollbar-thumb-[var(--control-border)] border-0 focus-visible:ring-0 shadow-none"
          style={{ height: "40px" }}
        />
      </div>

      {isImageMode && (
        <button
          type="button"
          onClick={() => setIsImageMode(false)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)] hover:text-red-500 transition-colors"
          title="Cancel Image Mode"
        >
          <X className="w-5 h-5" />
        </button>
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
            ? "bg-[var(--control-bg)] text-[var(--text-secondary)] cursor-not-allowed"
            : isImageMode
              ? "bg-[var(--accent)] text-white hover:brightness-110 shadow-[0_0_15px_var(--accent)]"
              : "bg-[var(--accent)] text-[var(--surface)] hover:brightness-110 active:scale-95 hover:shadow-[0_0_15px_var(--glow)]"
        }`}
        title={isStreaming ? "Stop" : t?.send || "Send"}
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
