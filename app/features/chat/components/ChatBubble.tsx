// /app/features/chat/components/ChatBubble.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronRight, Sparkles, Brain } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Dynamic import for ChartTool
const ChartTool = dynamic(() => import("./ChartTool"), {
  loading: () => (
    <div className="w-full h-64 flex items-center justify-center bg-surface-muted rounded-xl animate-pulse">
      <span className="text-sm text-secondary">Loading Chart...</span>
    </div>
  ),
  ssr: false,
});

function TypingDots() {
  return (
    <div className="typing-dots flex items-center gap-1 px-2 py-1">
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" />
    </div>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="mb-4 rounded-lg border card-surface overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary hover:text-primary hover:bg-control-hover transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>Thinking Process</span>
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
        )}
      </button>

      {!isCollapsed && (
        <div className="px-3 py-3 border-t border-token text-sm text-secondary font-mono leading-relaxed bg-surface whitespace-pre-wrap animate-in slide-in-from-top-2 duration-200">
          {content}
        </div>
      )}
    </div>
  );
}

function extractThinking(text: string) {
  const patterns = [
    { start: "<think>", end: "</think>" },
    { start: "<thought>", end: "</thought>" },
  ];

  for (const { start, end } of patterns) {
    const startIndex = text.indexOf(start);
    if (startIndex !== -1) {
      const endIndex = text.indexOf(end, startIndex);

      if (endIndex !== -1) {
        const thought = text.slice(startIndex + start.length, endIndex);
        const rest = text.slice(0, startIndex) + text.slice(endIndex + end.length);
        return { thought, rest, isThinking: false };
      }

      const thought = text.slice(startIndex + start.length);
      const rest = text.slice(0, startIndex);
      return { thought, rest, isThinking: true };
    }
  }

  return { thought: null, rest: text, isThinking: false };
}

function getLang(className?: string) {
  const m = /language-([a-z0-9-]+)/i.exec(className || "");
  return m?.[1]?.toLowerCase() || "text";
}

const extractText = (node: React.ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) return extractText((node.props as any).children);
  return "";
};

function SmartCode({ inline, className, children }: any) {
  const { t } = useLanguage();

  const codeText = useMemo(() => {
    const raw = extractText(children);
    return raw.replace(/\r\n/g, "\n").replace(/^\n+/, "").replace(/\n+$/, "");
  }, [children]);

  if (inline) {
    return (
      <code className="rounded bg-control px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--primary-light)]">
        {children}
      </code>
    );
  }

  const lang = getLang(className);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code to clipboard:", err);
    }
  };

  const lineCount = codeText.split("\n").length;
  const COLLAPSE_AFTER_LINES = 20;
  const isCollapsible = lineCount > COLLAPSE_AFTER_LINES;
  const isCollapsed = isCollapsible && !expanded;

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border card-surface shadow-2xl transition-all hover:border-token">
      <div className="flex items-center justify-between bg-surface-muted px-4 py-3 border-b border-token select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 opacity-60 group-hover/code:opacity-100 transition-opacity">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-3 text-[11px] font-mono font-medium text-secondary uppercase tracking-wider">
            {lang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isCollapsible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-2 py-1 rounded hover:bg-control-hover text-[10px] font-bold text-secondary hover:text-primary transition-colors uppercase tracking-wider"
            >
              {expanded ? t("collapse") : t("expand")}
            </button>
          )}

          <button
            onClick={handleCopy}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-200
              text-[10px] font-bold uppercase tracking-wider
              ${
                copied
                  ? "bg-green-500/10 text-green-400"
                  : "text-secondary hover:text-primary hover:bg-control-hover"
              }
            `}
          >
            {copied ? t("copied") : t("copy")}
          </button>
        </div>
      </div>

      <div className={`relative ${isCollapsed ? "max-h-[320px]" : ""} transition-all duration-300`}>
        <pre className="p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          <code
            className={`${className} !bg-transparent text-[13px] leading-6 font-mono !p-0 block min-w-full`}
          >
            {children}
          </code>
        </pre>
        {isCollapsed && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--surface)] via-[color-mix(in_srgb,var(--surface)_80%,transparent)] to-transparent pointer-events-none flex items-end justify-center pb-4">
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">
              {lineCount - COLLAPSE_AFTER_LINES} more lines...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreBlock({ children }: any) {
  if (
    (React.isValidElement(children) && ((children.type === "code") as any)) ||
    children?.props?.className
  ) {
    const childProps = children.props || {};
    const className = childProps.className || "";
    const isJson = className.includes("language-json");

    if (isJson) {
      try {
        const textContent = extractText(childProps.children);
        // Robust extraction: find the outer braces to handle potential leading/trailing whitespace or text
        const start = textContent.indexOf("{");
        const end = textContent.lastIndexOf("}");

        if (start !== -1 && end !== -1 && end > start) {
          const potentialJson = textContent.slice(start, end + 1);
          // Quick check before parsing
          if (potentialJson.includes("chart")) {
            const parsed = JSON.parse(potentialJson);
            if (parsed.type === "chart") {
              return <ChartTool {...parsed} />;
            }
          }
        }
      } catch {
        // Ignore JSON parse errors, render as code
      }
    }

    return (
      <SmartCode inline={false} className={childProps.className} {...childProps}>
        {childProps.children}
      </SmartCode>
    );
  }

  return <pre>{children}</pre>;
}

function InlineCode({ children, className, ...props }: any) {
  return (
    <SmartCode inline={true} className={className} {...props}>
      {children}
    </SmartCode>
  );
}

interface ChatBubbleProps {
  message: {
    role: string;
    content: string;
    sources?: any[];
    urlContext?: any[];
    id?: string;
  };
  role?: string;
  content?: string;
  sources?: any[];
  urlContext?: any[];
  isLastAssistant?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onEdit?: (message: any, newContent: string) => void;
  regenerating?: boolean;
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
}: ChatBubbleProps) {
  const { t } = useLanguage();
  const safeMessage = useMemo(() => {
    const base = message && typeof message === "object" ? message : ({} as any);
    const finalRole = base.role || role || "assistant";
    const finalContent = base.content || content || "";
    const finalSources = base.sources || sourcesProp || [];
    const finalUrlContext = base.urlContext || urlContextProp || [];
    return {
      role: finalRole,
      content: finalContent,
      sources: finalSources,
      urlContext: finalUrlContext,
      id: base.id,
    };
  }, [message, role, content, sourcesProp, urlContextProp]);

  const isBot = safeMessage.role === "assistant";
  const [copied, setCopied] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(safeMessage.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const {
    thought,
    rest: displayContent,
    isThinking: isStreamThinking,
  } = useMemo(() => {
    if (!isBot) return { thought: null, rest: safeMessage.content, isThinking: false };
    return extractThinking(safeMessage.content || "");
  }, [safeMessage.content, isBot]);

  const hasContent = Boolean(displayContent?.trim()) || Boolean(thought?.trim());
  const isLoading = isBot && isLastAssistant && (regenerating || !hasContent);
  const showTyping =
    isLoading || (isBot && isLastAssistant && isStreamThinking && !displayContent.trim());

  return (
    <div className={`group flex w-full flex-col gap-3 py-6 ${isBot ? "" : "items-end"}`}>
      <div
        className={`flex max-w-[95%] lg:max-w-[90%] gap-4 ${isBot ? "items-start" : "flex-row-reverse items-start"}`}
      >
        <div
          className={`relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-[10px] font-black tracking-tighter shadow-sm overflow-hidden transition-all duration-300
          ${
            isBot
              ? isLoading
                ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                : "border-token bg-surface-elevated text-primary"
              : "border-[var(--primary)]/20 bg-[var(--primary)] text-[var(--surface)]"
          }`}
        >
          {isBot ? (
            isLoading ? (
              <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
            ) : (
              <span className="scale-100 transition-transform group-hover:scale-110">AI</span>
            )
          ) : (
            "ME"
          )}

          {isBot && isLoading && (
            <div className="absolute inset-0 border border-blue-400/30 rounded-lg animate-ping opacity-20" />
          )}
        </div>

        <div
          className={`flex flex-col gap-2 ${isBot ? "items-start w-full min-w-0" : "items-end max-w-full"}`}
        >
          <div
            className={`relative rounded-2xl px-1 text-sm leading-relaxed transition-all
            ${isBot ? "text-primary w-full" : "bg-[var(--primary)] px-4 py-2.5 text-[var(--surface)] shadow-lg"}`}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[300px] w-full">
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  className="w-full bg-surface-elevated text-primary p-3 rounded-md outline-none resize-none overflow-hidden font-mono text-sm leading-6 border border-token min-h-[40px] focus-visible:ring-0"
                  rows={1}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-control hover:bg-control-hover rounded-md transition-colors text-secondary"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-accent text-[var(--surface)] hover:brightness-110 rounded-md transition-colors shadow-sm"
                  >
                    {t("save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col w-full overflow-hidden">
                {thought && typeof thought === "string" && <ThinkingBlock content={thought} />}

                {(!hasContent && isLoading) || (showTyping && !displayContent.trim()) ? (
                  <TypingDots />
                ) : (
                  <div className="chat-markdown-container chat-markdown w-full overflow-hidden">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code: InlineCode,
                        pre: PreBlock,
                        p: ({ children }) => (
                          <p className="mb-4 last:mb-0 leading-7 break-words">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>
                        ),
                        li: ({ children }) => <li className="leading-7">{children}</li>,
                        h1: ({ children }) => (
                          <h1 className="mt-8 mb-4 text-2xl font-bold text-primary border-b border-token pb-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="mt-7 mb-3 text-xl font-bold text-primary">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mt-6 mb-2 text-lg font-bold text-primary">{children}</h3>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-token pl-4 py-1 my-4 text-secondary italic">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--primary-light)] hover:underline break-all"
                          >
                            {children}
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4 rounded-lg border border-token bg-surface-elevated">
                            <table className="w-full text-left text-sm">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-surface-muted uppercase font-bold text-xs text-secondary">
                            {children}
                          </thead>
                        ),
                        th: ({ children }) => (
                          <th className="px-4 py-3 border-b border-token text-primary">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-3 border-b border-token text-secondary">
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {displayContent}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {isBot && (safeMessage.sources.length > 0 || safeMessage.urlContext.length > 0) && (
              <div className="mt-6 space-y-4 border-t border-token pt-4">
                {safeMessage.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {safeMessage.sources.slice(0, 5).map((s: any, idx: number) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-full border border-token bg-surface-elevated px-3 py-1 text-[10px] text-secondary hover:bg-control-hover hover:text-primary transition-all max-w-[200px]"
                      >
                        <span className="font-bold shrink-0">[{idx + 1}]</span>
                        <span className="truncate">{s.title || s.uri}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isLoading && !isEditing && (
            <div
              className={`flex items-center gap-4 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isBot ? "" : "flex-row-reverse"}`}
            >
              <button
                onClick={handleCopyMessage}
                className="text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter transition-colors"
                title={copied ? t("copied") : t("copy")}
              >
                {copied ? t("copied") : t("copy")}
              </button>

              {!isBot && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter transition-colors"
                  title={t("edit")}
                >
                  {t("edit")}
                </button>
              )}

              {isBot && canRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1 text-[10px] font-bold text-secondary hover:text-primary uppercase tracking-tighter disabled:opacity-30 transition-colors"
                  title={t("regenerate")}
                >
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
