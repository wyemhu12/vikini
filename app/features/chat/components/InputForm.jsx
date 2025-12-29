// /app/features/chat/components/InputForm.jsx
"use client";

import { useRef, useEffect, useState } from "react";
import { useAttachmentStore } from "@/lib/features/attachments/store";

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

const PaperClipIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
    />
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

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  onStop, // Add onStop prop
  disabled,
  isStreaming, // Add isStreaming prop to know when to show Stop button
  t,
  conversationId,
}) {
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { addAttachment, attachments } = useAttachmentStore();
  const [isUploading, setIsUploading] = useState(false);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // On mobile (screen width < 768px), Enter should just be a newline
      // Only prevent default and submit if on desktop
      if (window.innerWidth >= 768) {
        e.preventDefault();
        if (!disabled && (input.trim() || attachments.length > 0)) {
          onSubmit();
          // Reset height
          if (textareaRef.current) textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const f of files) {
        if (!conversationId) {
          console.warn("No conversation ID for upload yet");
          continue;
        }

        // Upload via API endpoint
        const form = new FormData();
        form.set("conversationId", conversationId);
        form.set("file", f);

        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: form,
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Upload failed");
        }

        if (json?.attachment) {
          addAttachment(json.attachment);
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
          onSubmit();
        }
      }}
      className="relative flex w-full items-end gap-2 rounded-3xl bg-[#0f1115] border border-white/10 p-2 shadow-2xl transition-all duration-300 focus-within:border-[var(--primary)]/50 focus-within:ring-1 focus-within:ring-[var(--primary)]/20"
    >
      {/* File Upload Button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
        title={t?.uploadFile || "Upload file"}
      >
        <PaperClipIcon />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={input}
        onChange={(e) => onChangeInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t?.placeholder || "Message..."}
        disabled={disabled}
        className="max-h-[200px] min-h-[40px] w-full resize-none bg-transparent py-2.5 text-[15px] text-white placeholder-neutral-500 outline-none scrollbar-thin scrollbar-thumb-neutral-700"
        style={{ height: "40px" }}
      />

      {/* Send / Stop Button - THEMED */}
      <button
        type="submit"
        // Button enabled if:
        // 1. Streaming (to allow Stop)
        // 2. OR Input not empty/has attachments AND not disabled/uploading
        disabled={
          !isStreaming &&
          ((!input.trim() && attachments.length === 0) || (disabled && !isUploading))
        }
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 shadow-lg ${
          !isStreaming &&
          ((!input.trim() && attachments.length === 0) || (disabled && !isUploading))
            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            : "bg-[var(--primary)] text-black hover:brightness-110 active:scale-95 hover:shadow-[0_0_15px_var(--primary)]"
        }`}
        title={isStreaming ? "Stop" : t?.send || "Send"}
      >
        {isStreaming ? <StopIcon /> : <PaperAirplaneIcon />}
      </button>
    </form>
  );
}
