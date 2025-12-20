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

        {isCollapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-neutral-950/90 to-transparent" />
        )}
      </div>
    </div>
  );
}

export default function ChatBubble({
  // preferred
  message,

  // fallback props for compatibility
  role,
  content,
  sources: sourcesProp,
  urlContext: urlContextProp,

  isLastAssistant,
  canRegenerate,
  onRegenerate,
  regenerating,
}) {
  // ✅ Build a safe message object even when 'message' is undefined
  const safeMessage = useMemo(() => {
    const base = message && typeof message === "object" ? message : {};

    const finalRole =
      typeof base.role === "string"
        ? base.role
        : typeof role === "string"
          ? role
          : "assistant";

    const finalContent =
      typeof base.content === "string"
        ? base.content
        : typeof content === "string"
          ? content
          : String(base.content ?? content ?? "");

    const finalSources = Array.isArray(base.sources)
      ? base.sources
      : Array.isArray(sourcesProp)
        ? sourcesProp
        : [];

    const finalUrlContext = Array.isArray(base.urlContext)
      ? base.urlContext
      : Array.isArray(urlContextProp)
        ? urlContextProp
        : [];

    return {
      ...base,
      role: finalRole,
      content: finalContent,
      sources: finalSources,
      urlContext: finalUrlContext,
    };
  }, [message, role, content, sourcesProp, urlContextProp]);

  const isBot = safeMessage.role === "assistant";

  const [copied, setCopied] = useState(false);
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(safeMessage.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  const sources = Array.isArray(safeMessage?.sources) ? safeMessage.sources : [];
  const urlContext = Array.isArray(safeMessage?.urlContext) ? safeMessage.urlContext : [];

  return (
    <div className={`flex items-start gap-3 ${isBot ? "justify-start" : "justify-end"}`}>
      {isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-semibold text-black">
          AI
        </div>
      )}

      <div className={`group relative max-w-[86%] ${isBot ? "" : "text-right"}`}>
        <div
          className={[
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ring-1",
            isBot
              ? "bg-neutral-900/80 text-neutral-100 ring-neutral-800"
              : "bg-[var(--primary)] text-black ring-[var(--primary)]",
          ].join(" ")}
        >
          {/* ✅ Render BOTH sides with markdown (ChatGPT-like) and preserve newlines via CSS */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code: CodeBlock,
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
            {safeMessage.content}
          </ReactMarkdown>

          {/* ✅ Citations / Sources */}
          {isBot && sources.length > 0 && (
            <div className="mt-3 border-t border-neutral-800/80 pt-2">
              <div className="text-[11px] font-medium text-neutral-300">Nguồn</div>
              <div className="mt-1 flex flex-col gap-1">
                {sources.slice(0, 8).map((s, idx) => (
                  <a
                    key={`${s?.uri ?? "src"}-${idx}`}
                    href={s?.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--primary-light)] underline underline-offset-2 hover:opacity-90"
                  >
                    [{idx + 1}] {s?.title || s?.uri}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* (Optional) url_context status */}
          {isBot && urlContext.length > 0 && (
            <div className="mt-3 border-t border-neutral-800/80 pt-2">
              <div className="text-[11px] font-medium text-neutral-300">URL Context</div>
              <div className="mt-1 flex flex-col gap-1">
                {urlContext.slice(0, 6).map((u, idx) => (
                  <div
                    key={`${u?.retrievedUrl ?? "url"}-${idx}`}
                    className="text-[11px] text-neutral-400"
                  >
                    <span className="text-neutral-300">{u?.status || "STATUS"}</span>
                    {" — "}
                    <a
                      href={u?.retrievedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--primary-light)] underline underline-offset-2 hover:opacity-90"
                    >
                      {u?.retrievedUrl}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="pointer-events-none absolute -top-3 right-1 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="rounded-md bg-neutral-900/90 px-1.5 py-1 text-[10px] text-neutral-300 shadow-sm ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            {copied ? "✓" : "⧉"}
          </button>

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
