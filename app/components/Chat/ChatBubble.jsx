"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";

export default function ChatBubble({
  message,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  regenerating,
}) {
  const isBot = message.role === "assistant";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  return (
    <div
      className={`flex ${
        isBot ? "justify-start" : "justify-end"
      } gap-2 items-end`}
    >
      {/* Avatar */}
      {isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-dark)] text-[10px] font-semibold text-[var(--primary-light)]">
          G
        </div>
      )}

      <div className="group relative max-w-full sm:max-w-[75%]">
        <div
          className={`rounded-xl border px-4 py-3 text-sm sm:text-base leading-relaxed ${
            isBot
              ? "border-neutral-800 bg-neutral-900 text-neutral-100"
              : "border-[var(--primary-dark)] bg-[var(--primary)] text-black"
          }`}
        >
          {isBot ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="pointer-events-none absolute -top-3 right-1 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">

          {/* COPY BUTTON */}
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-neutral-900/90 px-1.5 py-1 text-[10px] text-neutral-300 shadow-sm ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            {copied ? "✓" : "⧉"}
          </button>

          {/* REGENERATE BUTTON */}
          {isBot && isLastAssistant && canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-md bg-neutral-900/90 px-1.5 py-1 text-[10px] text-neutral-300 shadow-sm ring-1 ring-neutral-700 hover:bg-neutral-800 disabled:opacity-40"
              disabled={regenerating}
            >
              {regenerating ? (
                <span className="animate-spin inline-block">🔄</span>
              ) : (
                "🔄"
              )}
            </button>
          )}
        </div>
      </div>

      {!isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-semibold text-neutral-50">
          U
        </div>
      )}
    </div>
  );
}
