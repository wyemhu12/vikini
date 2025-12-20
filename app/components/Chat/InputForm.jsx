"use client";

import { useRef, useEffect, useState, useCallback } from "react";

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

async function uploadOneImage({ conversationId, file }) {
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

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  disabled,
  t,
  conversationId,
}) {
  const textareaRef = useRef(null);

  const [pasting, setPasting] = useState(false);
  const [pasteError, setPasteError] = useState("");

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const lineHeight = 24; // text-base + leading-relaxed
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

  const onPaste = useCallback(
    async (e) => {
      // Requirement: paste image into chat ONLY when chat input is selected.
      // This handler is attached to the textarea, so it only runs when focused.
      if (disabled) return;

      const images = extractClipboardImages(e.clipboardData);
      if (images.length === 0) return; // allow normal paste (text)

      if (!conversationId) {
        // Conversation-level attachments require conversationId (upload endpoint needs it).
        // Keep it simple: user should send a message once to create conversation.
        e.preventDefault();
        setPasteError("Create/select a chat first, then paste the image again.");
        return;
      }

      e.preventDefault();
      setPasteError("");
      setPasting(true);

      try {
        // Upload sequentially to respect server limits.
        for (const f of images) {
          await uploadOneImage({ conversationId, file: f });
        }

        // Notify attachments panel to refresh (no prop drilling).
        window.dispatchEvent(
          new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
        );
      } catch (err) {
        console.error(err);
        setPasteError(String(err?.message || "Paste upload failed"));
      } finally {
        setPasting(false);
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
        <textarea
          id="chat-input"
          ref={textareaRef}
          placeholder={t.placeholder}
          value={input}
          rows={1}
          onChange={(e) => onChangeInput(e.target.value)}
          onPaste={onPaste}
          className="
            flex-1 resize-none overflow-y-auto
            rounded-xl border border-neutral-800
            bg-neutral-900 px-3 py-2
            text-base sm:text-lg leading-relaxed
            transition-all duration-150
            focus:outline-none focus:border-[var(--primary)]
          "
          style={{ maxHeight: "120px" }}
        />

        <button
          type="submit"
          disabled={disabled}
          className="
            rounded-xl bg-[var(--primary)]
            px-4 py-2
            text-sm sm:text-base
            font-medium text-black
            disabled:opacity-40
          "
        >
          {pasting ? "Uploading..." : t.send}
        </button>
      </div>

      {pasteError ? (
        <div className="mt-2 text-xs text-red-300">{pasteError}</div>
      ) : null}
    </form>
  );
}
