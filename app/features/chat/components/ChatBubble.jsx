// /app/features/chat/components/ChatBubble.jsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useMemo, useState, useEffect, useRef } from "react";
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
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code to clipboard:", err);
    }
  };

  const lineCount = code.split("\n").length;
  const COLLAPSE_AFTER_LINES = 20;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;
  
  // Hiển thị tối đa khi collapse
  const isCollapsed = isCollapsible && !expanded;

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl transition-all hover:border-white/20">
      {/* Mac-style Header */}
      <div className="flex items-center justify-between bg-[#161b22] px-4 py-3 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 opacity-60 group-hover/code:opacity-100 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-3 text-[11px] font-mono font-medium text-white/40 uppercase tracking-wider">
            {lang}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 py-1 rounded hover:bg-white/5 text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-wider"
            >
              {expanded ? t("collapse") : t("expand")}
            </button>
          )}
          
          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-200
              text-[10px] font-bold uppercase tracking-wider
              ${copied 
                ? "bg-green-500/10 text-green-400" 
                : "text-white/40 hover:text-white hover:bg-white/5"}
            `}
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                {t("copied")}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
                </svg>
                {t("copy")}
              </>
            )}
          </button>
        </div>
      </div>

      <div className={`relative ${isCollapsed ? "max-h-[320px]" : ""} transition-all duration-300`}>
        <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          <code className={`${className} !bg-transparent text-[13px] leading-6 font-mono !p-0 block min-w-full`}>
            {code}
          </code>
        </pre>
        
        {/* Gradient Fade for Collapsed State */}
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent pointer-events-none flex items-end justify-center pb-4">
             <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
               {lineCount - COLLAPSE_AFTER_LINES} more lines...
             </div>
          </div>
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
  onEdit, 
  regenerating,
}) {
  const { t } = useLanguage();
  const safeMessage = useMemo(() => {
    const base = message && typeof message === "object" ? message : {};
    const finalRole = base.role || role || "assistant";
    const finalContent = base.content || content || "";
    const finalSources = base.sources || sourcesProp || [];
    const finalUrlContext = base.urlContext || urlContextProp || [];
    return { 
      role: finalRole, 
      content: finalContent, 
      sources: finalSources, 
      urlContext: finalUrlContext,
      id: base.id 
    };
  }, [message, role, content, sourcesProp, urlContextProp]);

  const isBot = safeMessage.role === "assistant";
  const [copied, setCopied] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(safeMessage.content);
  const textareaRef = useRef(null);

  useEffect(() => {
    setEditContent(safeMessage.content);
  }, [safeMessage.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(safeMessage.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== safeMessage.content) {
      onEdit?.(safeMessage, editContent);
    }
    setIsEditing(false);
  };

  const isTyping = isBot && isLastAssistant && !regenerating && !String(safeMessage.content).trim();

  return (
    <div className={`group flex w-full flex-col gap-3 py-6 ${isBot ? "" : "items-end"}`}>
      <div className={`flex max-w-[95%] lg:max-w-[90%] gap-4 ${isBot ? "items-start" : "flex-row-reverse items-start"}`}>
        {/* Avatar */}
        <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-[10px] font-black tracking-tighter shadow-sm
          ${isBot 
            ? "border-white/10 bg-white/5 text-white" 
            : "border-[var(--primary)]/20 bg-[var(--primary)] text-black"}`}>
          {isBot ? "AI" : "ME"}
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 ${isBot ? "items-start w-full min-w-0" : "items-end max-w-full"}`}>
          <div className={`relative rounded-2xl px-1 text-sm leading-relaxed transition-all
            ${isBot ? "text-neutral-200 w-full" : "bg-[var(--primary)] px-4 py-2.5 text-black shadow-lg"}`}>
            
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[300px] w-full">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  className="w-full bg-black/10 text-black p-3 rounded-md outline-none resize-none overflow-hidden font-mono text-sm leading-6"
                  rows={1}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-black/10 hover:bg-black/20 rounded-md transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-black/80 text-white hover:bg-black rounded-md transition-colors shadow-sm"
                  >
                    {t("save")}
                  </button>
                </div>
              </div>
            ) : isTyping ? (
              <TypingDots />
            ) : (
              <div className="chat-markdown-container w-full overflow-hidden">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: CodeBlock,
                    p: ({ children }) => <p className="mb-4 last:mb-0 leading-7 break-words">{children}</p>,
                    ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>,
                    li: ({ children }) => <li className="leading-7">{children}</li>,
                    h1: ({ children }) => <h1 className="mt-8 mb-4 text-2xl font-bold text-white border-b border-white/10 pb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="mt-7 mb-3 text-xl font-bold text-white">{children}</h2>,
                    h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-bold text-white">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-white/20 pl-4 py-1 my-4 text-white/60 italic">{children}</blockquote>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary-light)] hover:underline break-all">{children}</a>,
                    table: ({ children }) => <div className="overflow-x-auto my-4 rounded-lg border border-white/10"><table className="w-full text-left text-sm">{children}</table></div>,
                    thead: ({ children }) => <thead className="bg-white/5 uppercase font-bold text-xs text-white/70">{children}</thead>,
                    th: ({ children }) => <th className="px-4 py-3 border-b border-white/10">{children}</th>,
                    td: ({ children }) => <td className="px-4 py-3 border-b border-white/5">{children}</td>,
                  }}
                  className="chat-markdown"
                >
                  {safeMessage.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Sources & Context */}
            {isBot && (safeMessage.sources.length > 0 || safeMessage.urlContext.length > 0) && (
              <div className="mt-6 space-y-4 border-t border-white/5 pt-4">
                {safeMessage.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {safeMessage.sources.slice(0, 5).map((s, idx) => (
                      <a key={idx} href={s.uri} target="_blank" rel="noreferrer" 
                         className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition-all max-w-[200px]">
                        <span className="font-bold shrink-0">[{idx + 1}]</span>
                        <span className="truncate">{s.title || s.uri}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          {!isTyping && !isEditing && (
            <div className={`flex items-center gap-4 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isBot ? "" : "flex-row-reverse"}`}>
               {/* Copy Button */}
               <button onClick={handleCopyMessage} className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-tighter transition-colors">
                  {copied ? t("copied") : t("copy")}
               </button>

               {/* Edit Button for User */}
               {!isBot && (
                 <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-tighter transition-colors">
                    {t("edit")}
                 </button>
               )}

               {/* Regenerate Button for AI */}
               {isBot && canRegenerate && (
                 <button onClick={onRegenerate} disabled={regenerating} className="flex items-center gap-1 text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-tighter disabled:opacity-30 transition-colors">
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
