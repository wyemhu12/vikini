"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";

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

    const ext =
      type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/jpeg"
            ? "jpg"
            : "img";

    out.push(
      new File([blob], `pasted-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`, {
        type,
      })
    );
  }

  return out;
}

async function uploadImages({ conversationId, images }) {
  for (const file of images) {
    const form = new FormData();
    form.set("conversationId", conversationId);
    form.set("file", file);

    const res = await fetch("/api/attachments/upload", {
      method: "POST",
      body: form,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || "Upload failed");
    }
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
  const [pasteError, setPasteError] = useState("");

  // NOTE:
  // ChatApp now passes `disabled` only for "busy" states (streaming/regenerate/creating).
  // Send button still needs to be disabled when input is empty.
  const sendDisabled = useMemo(() => disabled || !String(input || "").trim(), [disabled, input]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const lineHeight = 24; // phù hợp text-base + leading-relaxed
    const maxLines = 5;
    const maxHeight = lineHeight * maxLines;

    const targetHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.transition = "height 120ms ease";
    textarea.style.height = `${targetHeight}px`;
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handlePaste = useCallback(
    async (e) => {
      // Requirement: paste image into chat ONLY when chat textarea is focused.
      // This handler is attached directly to the textarea, so it only fires when focused.
      const images = extractClipboardImages(e.clipboardData);
      if (images.length === 0) return; // allow normal paste (text)

      // Do not allow paste-uploads during busy states (streaming/regen/creating).
      if (disabled) return;

      // Need conversationId to upload attachments
      if (!conversationId) {
        e.preventDefault();
        setPasteError("Hãy tạo/chọn một chat (có conversationId) rồi paste lại ảnh.");
        return;
      }

      e.preventDefault();
      setPasteError("");

      try {
        await uploadImages({ conversationId, images });

        // Notify AttachmentsPanel to refresh
        window.dispatchEvent(
          new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
        );
      } catch (err) {
        console.error(err);
        setPasteError(String(err?.message || "Paste upload failed"));
      }
    },
    [conversationId, disabled]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="
        bg-neutral-950 
        px-4 py-3
        sticky bottom-0
        shadow-[0_-4px_10px_rgba(0,0,0,0.35)]
      "
    >
      <div className="flex items-end gap-2">
        {/* TEXTAREA */}
        <textarea
          id="chat-input"
          ref={textareaRef}
          placeholder={t.placeholder}
          value={input}
          rows={1}
          onChange={(e) => onChangeInput(e.target.value)}
          onPaste={handlePaste}
          className="
            flex-1 resize-none overflow-y-auto
            rounded-xl border border-neutral-800
            bg-neutral-900 px-3 py-2
            text-base sm:text-lg leading-relaxed
            transition-all duration-150
            focus:outline-none focus:border-[var(--primary)]
          "
          style={{
            maxHeight: "120px",
          }}
        />

        {/* SEND BUTTON */}
        <button
          type="submit"
          disabled={sendDisabled}
          className="
            rounded-xl bg-[var(--primary)]
            px-4 py-2
            text-sm sm:text-base
            font-medium text-black
            disabled:opacity-40
          "
        >
          {t.send}
        </button>
      </div>

      {pasteError ? (
        <div className="mt-2 text-xs text-red-300">{pasteError}</div>
      ) : null}
    </form>
  );
}
