"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";


function TypingDots() {
  return (
    <div className="typing-dots flex items-center gap-1 px-0.5 py-1">
      <span />
      <span />
      <span />
    </div>
  );
}

function getLang(className) {
  const m = /language-([a-z0-9-]+)/i.exec(className || "");
  return m?.[1]?.toLowerCase() || "text";
}

function CodeBlock({ inline, className, children }) {
  const { t } = useLanguage();
  const code = useMemo(() => {
    const raw = Array.isArray(children) ? children.join("") : String(children || "");
    const normalized = raw.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
    return normalized;
  }, [children]);

  if (inline) {
    return (
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--primary-light)]">
        {code}
      </code>
    );
  }

  const lang = getLang(className);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch (err) {
      console.error("Failed to copy code to clipboard:", err);
    }
  };

  const lineCount = code.split("\n").length;
  const COLLAPSE_AFTER_LINES = 15;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]">
      <div className="flex items-center justify-between bg-white/5 px-4 py-2 border-b border-white/5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          {lang}
        </div>
        <div className="flex items-center gap-3">
          {isCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
            >
              {expanded ? t("collapse") : t("expand")}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-[11px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>
      <div className={`relative ${isCollapsible && !expanded ? "max-h-[400px]" : "max-h-none"} overflow-auto`}>
        <pre className="p-4 text-[13px] leading-6 font-mono">
          <code className={className}>{code}</code>
        </pre>
        {isCollapsible && !expanded && (
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default function ChatBubble({
  message,
  role,
  content,
  sources: sourcesProp,
  urlContext: urlContextProp,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  regenerating,
}) {
  const { t } = useLanguage();
  const safeMessage = useMemo(() => {
    const base = message && typeof message === "object" ? message : {};
    const finalRole = base.role || role || "assistant";
    const finalContent = base.content || content || "";
    const finalSources = base.sources || sourcesProp || [];
    const finalUrlContext = base.urlContext || urlContextProp || [];
    return { role: finalRole, content: finalContent, sources: finalSources, urlContext: finalUrlContext };
  }, [message, role, content, sourcesProp, urlContextProp]);

  const isBot = safeMessage.role === "assistant";
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(safeMessage.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isTyping = isBot && isLastAssistant && !regenerating && !String(safeMessage.content).trim();

  return (
    <div className={`group flex w-full flex-col gap-3 py-6 ${isBot ? "" : "items-end"}`}>
      <div className={`flex max-w-[90%] gap-4 ${isBot ? "items-start" : "flex-row-reverse items-start"}`}>
        {/* Avatar */}
        <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-[10px] font-black tracking-tighter shadow-sm
          ${isBot 
            ? "border-white/10 bg-white/5 text-white" 
            : "border-[var(--primary)]/20 bg-[var(--primary)] text-black"}`}>
          {isBot ? "AI" : "ME"}
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 ${isBot ? "items-start" : "items-end"}`}>
          <div className={`relative rounded-2xl px-1 text-sm leading-relaxed transition-all
            ${isBot ? "text-neutral-200" : "bg-[var(--primary)] px-4 py-2.5 text-black shadow-lg"}`}>
            
            {isTyping ? (
              <TypingDots />
            ) : (
              <div className="chat-markdown-container">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: CodeBlock,
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-7">{children}</p>,
                    ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ul>,
                    li: ({ children }) => <li className="leading-7">{children}</li>,
                    h1: ({ children }) => <h1 className="mt-8 mb-4 text-2xl font-bold text-white">{children}</h1>,
                    h2: ({ children }) => <h2 className="mt-7 mb-3 text-xl font-bold text-white">{children}</h2>,
                    h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-bold text-white">{children}</h3>,
                  }}
                  className="chat-markdown"
                >
                  {safeMessage.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Sources & Context (if any) */}
            {isBot && (safeMessage.sources.length > 0 || safeMessage.urlContext.length > 0) && (
              <div className="mt-6 space-y-4 border-t border-white/5 pt-4">
                {safeMessage.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {safeMessage.sources.slice(0, 5).map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-all">
                        <span className="font-bold">[{idx + 1}]</span>
                        <span className="max-w-[120px] truncate">{s.title || s.uri}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          {isBot && !isTyping && (
            <div className="flex items-center gap-4 px-1 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button onClick={handleCopyMessage} className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-tighter">
                  {copied ? t("copied") : t("copy")}
               </button>
               {isLastAssistant && canRegenerate && (
                 <button onClick={onRegenerate} disabled={regenerating} className="flex items-center gap-1 text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-tighter disabled:opacity-30">
                    <span className={regenerating ? "animate-spin" : ""}>🔄</span>
                    {regenerating ? t("thinking") : t("regenerate")}
                 </button>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
