// /app/features/chat/components/InputForm.jsx
"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";

// Icons
const PaperAirplaneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
  </svg>
);

const PaperClipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
  </svg>
);

function extractClipboardImages(clipboardData) {
  const out = [];
  const items = clipboardData?.items ? Array.from(clipboardData.items) : [];
  for (const item of items) {
    if (!item) continue;
    if (item.kind !== "file") continue;
    const type = String(item.type || "");
    if (!type.startsWith("image/")) continue;
    const blob = item.getAsFile?.();
    if (!blob) continue;
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "img";
    out.push(new File([blob], `pasted-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`, { type }));
  }
  return out;
}

async function uploadImages({ conversationId, images }) {
  for (const file of images) {
    const form = new FormData();
    form.set("conversationId", conversationId);
    form.set("file", file);
    const res = await fetch("/api/attachments/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Upload failed");
  }
}

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  disabled,
  t,
  conversationId,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [pasteError, setPasteError] = useState("");

  const sendDisabled = useMemo(() => disabled || !String(input || "").trim(), [disabled, input]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 24; 
    const maxLines = 6;
    const maxHeight = lineHeight * maxLines;
    const targetHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.transition = "height 120ms ease";
    textarea.style.height = `${targetHeight}px`;
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handlePaste = useCallback(async (e) => {
      const images = extractClipboardImages(e.clipboardData);
      if (images.length === 0) return; 
      if (disabled) return;
      if (!conversationId) {
        e.preventDefault();
        setPasteError(t?.noConversations || "Please create a chat first.");
        return;
      }
      e.preventDefault();
      setPasteError("");
      try {
        await uploadImages({ conversationId, images });
        window.dispatchEvent(new CustomEvent("vikini:attachments-changed", { detail: { conversationId } }));
      } catch (err) {
        console.error(err);
        setPasteError(String(err?.message || "Upload failed"));
      }
    },
    [conversationId, disabled, t]
  );

  const handleFileSelect = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!conversationId) {
        setPasteError(t?.noConversations || "Please create a chat first.");
        e.target.value = "";
        return;
    }
    const files = Array.from(e.target.files);
    setPasteError("");
    try {
        await uploadImages({ conversationId, images: files });
        window.dispatchEvent(new CustomEvent("vikini:attachments-changed", { detail: { conversationId } }));
    } catch(err) {
        setPasteError(err.message || "Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div className="bg-neutral-950 px-4 py-4 sticky bottom-0 z-20">
      <form
        onSubmit={handleSubmit}
        className="
          relative flex items-end gap-2 
          max-w-3xl mx-auto
          rounded-2xl border border-neutral-800 
          bg-neutral-900 shadow-lg
          p-2 transition-all duration-200
          focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent
        "
      >
        <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileSelect}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="
            p-2.5 rounded-xl text-neutral-400 
            hover:bg-neutral-800 hover:text-neutral-200
            transition-colors duration-200
            active:scale-90
            disabled:opacity-50
          "
          title={t?.uploadFile || "Upload File"}
        >
          <PaperClipIcon />
        </button>

        <textarea
          id="chat-input"
          ref={textareaRef}
          placeholder={t?.placeholder || "Type your message..."}
          value={input}
          rows={1}
          onChange={(e) => onChangeInput(e.target.value)}
          onPaste={handlePaste}
          className="
            flex-1 resize-none overflow-y-auto
            bg-transparent px-1 py-2.5
            text-base text-white placeholder:text-neutral-500
            outline-none
          "
          style={{ maxHeight: "150px" }}
          onKeyDown={(e) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if(!sendDisabled) handleSubmit(e);
            }
          }}
        />

        {/* SEND BUTTON - THEME RESTORED */}
        <button
          type="submit"
          disabled={sendDisabled}
          className="
            p-2.5 rounded-xl 
            bg-[var(--primary)] text-black
            shadow-md
            transition-all duration-200 ease-in-out
            hover:brightness-110 hover:shadow-lg hover:-translate-y-0.5
            active:scale-90 active:translate-y-0
            disabled:bg-neutral-800 disabled:text-neutral-600 disabled:shadow-none disabled:translate-y-0
          "
        >
          <PaperAirplaneIcon />
        </button>
      </form>
      
      {pasteError && (
        <div className="max-w-3xl mx-auto mt-2 text-center text-xs text-red-400 animate-pulse">
            {pasteError}
        </div>
      )}
      
      <div className="text-center mt-2 text-[10px] text-neutral-600">
        {t?.aiDisclaimer || "Vikini can make mistakes. Check important info."}
      </div>
    </div>
  );
}
