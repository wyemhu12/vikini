"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useMemo, useState } from "react";

function getLang(className) {
  const m = /language-([a-z0-9-]+)/i.exec(className || "");
  return m?.[1]?.toLowerCase() || "text";
}

function CodeBlock({ inline, className, children }) {
  const code = useMemo(() => {
    const raw = Array.isArray(children) ? children.join("") : String(children || "");
    return raw.replace(/\n$/, "");
  }, [children]);

  // Inline code (như ChatGPT)
  if (inline) {
    return (
      <code className="rounded-md bg-neutral-800/60 px-1 py-0.5 text-[0.92em] text-neutral-100">
        {code}
      </code>
    );
  }

  const lang = getLang(className);
  const lines = useMemo(() => code.split("\n"), [code]);
  const lineCount = lines.length;

  const COLLAPSE_AFTER_LINES = 12;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          {lang}
        </div>

        <div className="flex items-center gap-2">
          {isCollapsible && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md bg-neutral-900/80 px-2 py-1 text-[11px] text-neutral-300 ring-1 ring-neutral-700 hover:bg-neutral-800"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-neutral-900/80 px-2 py-1 text-[11px] text-neutral-300 ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className={[
          "relative",
          "overflow-auto",
          isCollapsible && !expanded ? "max-h-[320px]" : "max-h-none",
        ].join(" ")}
      >
        <pre className="m-0 p-3 text-[12px] leading-5 text-neutral-100">
          <code className={className}>{code}</code>
        </pre>

        {/* Fade overlay when collapsed */}
        {isCollapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-neutral-950/90 to-transparent" />
        )}
      </div>
    </div>
  );
}

export default function ChatBubble({
  message,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  regenerating,
}) {
  const isBot = message.role === "assistant";
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} gap-2 items-end`}>
      {/* Avatar */}
      {isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-dark)] text-[10px] font-semibold text-[var(--primary-light)]">
          G
        </div>
      )}

      <div className="group relative max-w-full sm:max-w-[75%]">
        <div
          className={[
            "rounded-xl border px-4 py-3 leading-[1.65]",
            // ✅ giảm cỡ chữ trong bubble (responsive)
            "text-[13.5px] sm:text-[14px] md:text-[15px]",
            isBot
              ? "border-neutral-800 bg-neutral-900 text-neutral-100"
              : "border-[var(--primary-dark)] bg-[var(--primary)] text-black",
          ].join(" ")}
        >
          {isBot ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              // ✅ custom renderer cho code/pre theo kiểu ChatGPT
              components={{
                code: CodeBlock,
                pre: ({ children }) => <>{children}</>, // tránh bọc pre 2 lần
                p: ({ children }) => <p className="chat-p">{children}</p>,
                ul: ({ children }) => <ul className="chat-ul">{children}</ul>,
                ol: ({ children }) => <ol className="chat-ol">{children}</ol>,
                li: ({ children }) => <li className="chat-li">{children}</li>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--primary-light)] underline underline-offset-2 hover:opacity-90"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="chat-quote">{children}</blockquote>
                ),
              }}
              className="chat-markdown"
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="pointer-events-none absolute -top-3 right-1 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          {/* COPY BUTTON (whole message) */}
          <button
            type="button"
            onClick={handleCopyMessage}
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
