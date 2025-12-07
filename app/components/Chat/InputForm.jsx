"use client";

import { useRef, useEffect } from "react";

export default function InputForm({
  input,
  onChangeInput,
  onSubmit,
  disabled,
  t,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const lineHeight = 24; // phù hợp text-base + leading-relaxed
    const maxLines = 5;
    const maxHeight = lineHeight * maxLines;

    // Chiều cao tự nhiên
    const targetHeight = Math.min(textarea.scrollHeight, maxHeight);

    // Animation mượt giống ChatGPT
    textarea.style.transition = "height 120ms ease";
    textarea.style.height = `${targetHeight}px`;

  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

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
          ref={textareaRef}
          placeholder={t.placeholder}
          value={input}
          rows={1}
          onChange={(e) => onChangeInput(e.target.value)}
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
          disabled={disabled}
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
    </form>
  );
}
