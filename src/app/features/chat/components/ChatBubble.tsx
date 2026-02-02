// /app/features/chat/components/ChatBubble.tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../hooks/useLanguage";
import dynamic from "next/dynamic";
import { ChevronDown, Sparkles, Brain, ImageIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/utils/logger";
import { motion, AnimatePresence } from "framer-motion";

// Sub-components
import SmartCode, { extractText } from "./SmartCode";
import MessageActions from "./MessageActions";
import SourceLinks from "./SourceLinks";
import ImageGenPreview from "./ImageGenPreview";
import TokenBadge from "./TokenBadge";

// ============================================
// Type Definitions
// ============================================

interface MessageMeta {
  type?: "image_gen" | "text" | string;
  imageUrl?: string;
  prompt?: string;
  attachment?: { url: string };
  // Token usage fields
  totalTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  [key: string]: unknown;
}

interface ChatMessage {
  role: string;
  content: string;
  id?: string;
  sources?: unknown[];
  urlContext?: unknown[];
  meta?: MessageMeta;
  [key: string]: unknown;
}

interface MarkdownChildrenProps {
  children?: React.ReactNode;
}

interface MarkdownLinkProps extends MarkdownChildrenProps {
  href?: string;
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ReactElementProps {
  className?: string;
  children?: React.ReactNode;
}

// ============================================
// Dynamic Imports
// ============================================

const ChartTool = dynamic(() => import("./ChartTool"), {
  loading: () => (
    <div className="w-full h-64 flex items-center justify-center bg-surface-muted rounded-xl animate-pulse">
      <span className="text-sm text-secondary">Loading Chart...</span>
    </div>
  ),
  ssr: false,
});

// ============================================
// Helper Components
// ============================================

const TypingDots = React.memo(function TypingDots() {
  return (
    <div className="typing-dots flex items-center gap-1 px-2 py-1">
      <span className="w-1.5 h-1.5 bg-(--text-secondary) rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-(--text-secondary) rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-(--text-secondary) rounded-full animate-bounce" />
    </div>
  );
});

// Typing cursor for streaming text - blinking animation
const TypingCursor = React.memo(function TypingCursor() {
  return (
    <motion.span
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
      className="inline-block w-0.5 h-4 bg-(--primary) ml-0.5 align-middle rounded-sm"
      aria-hidden="true"
    />
  );
});

const ThinkingBlock = React.memo(function ThinkingBlock({ content }: { content: string }) {
  // Default to collapsed per user request
  const [isCollapsed, setIsCollapsed] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes (while expanded)
  useEffect(() => {
    if (!isCollapsed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isCollapsed]);

  return (
    <div className="mb-4 rounded-lg border border-white/10 overflow-hidden bg-white/3">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary hover:text-primary hover:bg-white/5 transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>Thinking Process</span>
        <motion.div
          className="ml-auto"
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 opacity-50" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="px-3 py-3 border-t border-white/10 text-sm text-secondary font-mono leading-relaxed bg-white/2 whitespace-pre-wrap max-h-96 overflow-y-auto"
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// Utility Functions
// ============================================

function extractThinking(text: string) {
  const patterns = [
    { start: "<think>", end: "</think>" },
    { start: "<thought>", end: "</thought>" },
  ];

  const thoughts: string[] = [];
  let rest = text;
  let isThinking = false;

  for (const { start, end } of patterns) {
    // Handle all complete blocks first
    const completeRegex = new RegExp(
      `${start.replace(/</g, "&lt;").replace(/>/g, "&gt;")}([\\s\\S]*?)${end.replace(/</g, "&lt;").replace(/>/g, "&gt;")}|${start}([\\s\\S]*?)${end}`,
      "gi"
    );

    let match;
    while ((match = completeRegex.exec(rest)) !== null) {
      const thought = match[1] || match[2] || "";
      if (thought.trim()) thoughts.push(thought.trim());
    }

    // Remove all complete blocks
    rest = rest.replace(new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`, "gi"), "");

    // Handle incomplete block (no closing tag - streaming)
    const startIndex = rest.indexOf(start);
    if (startIndex !== -1) {
      const incompleteThought = rest.slice(startIndex + start.length);
      if (incompleteThought.trim()) thoughts.push(incompleteThought.trim());
      rest = rest.slice(0, startIndex);
      isThinking = true;
    }
  }

  return {
    thought: thoughts.length > 0 ? thoughts.join("\n\n") : null,
    rest: rest.trim(),
    isThinking,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\<>]/g, "\\$&");
}

// ============================================
// Markdown Components
// ============================================

function PreBlock({ children }: MarkdownChildrenProps) {
  if (React.isValidElement(children)) {
    const childProps = (children.props || {}) as ReactElementProps;
    const className = childProps.className || "";
    const isCodeElement = children.type === "code" || className;

    if (isCodeElement) {
      const isJson = className.includes("language-json");

      if (isJson) {
        try {
          const textContent = extractText(childProps.children);
          const start = textContent.indexOf("{");
          const end = textContent.lastIndexOf("}");

          if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = textContent.slice(start, end + 1);
            if (potentialJson.includes("chart")) {
              interface ChartData {
                type: string;
                chartType?: string;
                title?: string;
                data: Array<Record<string, string | number>>;
                xKey: string;
                yKeys: string[];
                colors?: string[];
              }
              const parsed = JSON.parse(potentialJson) as ChartData;
              if (parsed.type === "chart" && parsed.data && parsed.xKey && parsed.yKeys) {
                return <ChartTool {...parsed} />;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      return (
        <SmartCode inline={false} className={className}>
          {childProps.children}
        </SmartCode>
      );
    }
  }
  return <pre>{children}</pre>;
}

function InlineCode({ children, className }: CodeProps) {
  return (
    <SmartCode inline={true} className={className}>
      {children}
    </SmartCode>
  );
}

// ============================================
// Main Component Props
// ============================================

interface ChatBubbleProps {
  message: ChatMessage;
  role?: string;
  content?: string;
  sources?: unknown[];
  urlContext?: unknown[];
  isLastAssistant?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onEdit?: (message: ChatMessage, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onImageRegenerate?: (message: ChatMessage) => void;
  onImageEdit?: (message: ChatMessage) => void;
  regenerating?: boolean;
  /** Is currently streaming response */
  isStreaming?: boolean;
  /** TTS callback */
  onSpeak?: () => void;
  /** Is TTS currently speaking this message */
  isSpeaking?: boolean;
}

// ============================================
// Main Component
// ============================================

const ChatBubble = React.memo(
  function ChatBubble({
    message,
    role,
    content,
    sources: sourcesProp,
    urlContext: urlContextProp,
    isLastAssistant,
    canRegenerate,
    onRegenerate,
    onEdit,
    onDelete,
    onImageRegenerate,
    onImageEdit,
    regenerating,
    isStreaming,
    onSpeak,
    isSpeaking,
  }: ChatBubbleProps) {
    const { t } = useLanguage();

    // Normalize message
    const safeMessage = useMemo((): ChatMessage => {
      const base: ChatMessage =
        message && typeof message === "object" ? message : { role: "assistant", content: "" };
      return {
        role: base.role || role || "assistant",
        content: base.content || content || "",
        sources: base.sources || sourcesProp || [],
        urlContext: base.urlContext || urlContextProp || [],
        id: base.id,
        meta: base.meta || {},
      };
    }, [message, role, content, sourcesProp, urlContextProp]);

    const isBot = safeMessage.role === "assistant";

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(safeMessage.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [copied, setCopied] = useState(false);

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

    // Handlers
    const handleCopyMessage = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(safeMessage.content || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error("Failed to copy:", err);
      }
    }, [safeMessage.content]);

    const handleSaveEdit = () => {
      if (editContent.trim() !== safeMessage.content) {
        onEdit?.(safeMessage, editContent);
      }
      setIsEditing(false);
    };

    // Extract thinking content
    const {
      thought,
      rest: displayContent,
      isThinking: isStreamThinking,
    } = useMemo(() => {
      if (!isBot) return { thought: null, rest: safeMessage.content, isThinking: false };
      return extractThinking(safeMessage.content || "");
    }, [safeMessage.content, isBot]);

    // Markdown components config
    const mdComponents = useMemo(
      () => ({
        code: InlineCode,
        pre: PreBlock,
        p: ({ children }: MarkdownChildrenProps) => (
          <p className="mb-4 last:mb-0 leading-7 wrap-break-word">{children}</p>
        ),
        ul: ({ children }: MarkdownChildrenProps) => (
          <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>
        ),
        ol: ({ children }: MarkdownChildrenProps) => (
          <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>
        ),
        li: ({ children }: MarkdownChildrenProps) => <li className="leading-7">{children}</li>,
        h1: ({ children }: MarkdownChildrenProps) => (
          <h1 className="mt-8 mb-4 text-2xl font-bold text-primary border-b border-token pb-2">
            {children}
          </h1>
        ),
        h2: ({ children }: MarkdownChildrenProps) => (
          <h2 className="mt-7 mb-3 text-xl font-bold text-primary">{children}</h2>
        ),
        h3: ({ children }: MarkdownChildrenProps) => (
          <h3 className="mt-6 mb-2 text-lg font-bold text-primary">{children}</h3>
        ),
        blockquote: ({ children }: MarkdownChildrenProps) => (
          <blockquote className="border-l-4 border-token pl-4 py-1 my-4 text-secondary italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }: MarkdownLinkProps) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--primary-light) hover:underline break-all"
          >
            {children}
          </a>
        ),
        table: ({ children }: MarkdownChildrenProps) => (
          <div className="overflow-x-auto my-4 rounded-lg border border-token bg-surface-elevated">
            <table className="w-full text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }: MarkdownChildrenProps) => (
          <thead className="bg-surface-muted uppercase font-bold text-xs text-secondary">
            {children}
          </thead>
        ),
        th: ({ children }: MarkdownChildrenProps) => (
          <th className="px-4 py-3 border-b border-token text-primary">{children}</th>
        ),
        td: ({ children }: MarkdownChildrenProps) => (
          <td className="px-4 py-3 border-b border-token text-secondary">{children}</td>
        ),
      }),
      []
    );

    // Loading states
    const hasContent = Boolean(displayContent?.trim()) || Boolean(thought?.trim());
    const isLoading = isBot && isLastAssistant && (regenerating || !hasContent);
    const showTyping =
      isLoading || (isBot && isLastAssistant && isStreamThinking && !displayContent.trim());

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`group flex w-full flex-col gap-3 py-6 ${isBot ? "" : "items-end"}`}
      >
        <div
          className={`flex max-w-[95%] lg:max-w-[90%] gap-4 ${isBot ? "items-start" : "flex-row-reverse items-start"}`}
        >
          {/* Avatar */}
          <div
            className={`relative flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border text-[10px] font-black tracking-tighter shadow-sm overflow-hidden transition-all duration-300
            ${
              isBot
                ? isLoading
                  ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  : "border-token bg-surface-elevated text-primary"
                : "border-(--primary)/20 bg-(--primary) text-(--surface)"
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

          {/* Content */}
          <div
            className={`flex flex-col gap-2 ${isBot ? "items-start w-full min-w-0" : "items-end max-w-full"}`}
          >
            <div
              className={`relative rounded-2xl px-1 text-sm leading-relaxed transition-all
              ${isBot ? "text-primary w-full" : "bg-(--primary) px-4 py-2.5 text-(--surface) shadow-lg"}`}
            >
              {isEditing ? (
                <div className="flex flex-col gap-2 w-full min-w-[60vw] md:min-w-[600px]">
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
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-accent text-(--surface) hover:brightness-110 rounded-md transition-colors shadow-sm"
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
                  ) : isBot ? (
                    <div className="chat-markdown-container chat-markdown w-full overflow-hidden">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={mdComponents}
                      >
                        {displayContent}
                      </ReactMarkdown>
                      {/* Typing cursor when streaming */}
                      {isStreaming && isLastAssistant && displayContent.trim() && <TypingCursor />}
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap wrap-break-word">{displayContent}</span>
                  )}
                </div>
              )}

              {/* Image Gen Preview */}
              {isBot &&
                safeMessage.meta?.type === "image_gen" &&
                (safeMessage.meta?.attachment?.url ? (
                  <ImageGenPreview
                    message={safeMessage}
                    onRegenerate={onImageRegenerate}
                    onEdit={onImageEdit}
                  />
                ) : (
                  /* Skeleton loader khi đang generate */
                  <div className="mt-4 rounded-xl overflow-hidden border border-token max-w-sm animate-pulse">
                    <div className="aspect-square bg-surface-muted flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-secondary/40" />
                    </div>
                    <div className="px-3 py-2 bg-surface-elevated border-t border-token">
                      <div className="h-3 bg-surface-muted rounded w-3/4"></div>
                    </div>
                  </div>
                ))}

              {/* Source Links */}
              {isBot && (safeMessage.sources?.length ?? 0) > 0 && (
                <SourceLinks sources={safeMessage.sources ?? []} />
              )}

              {/* Token Usage Badge */}
              {isBot && !isLoading && safeMessage.meta?.totalTokenCount && (
                <div className="mt-2 flex justify-end">
                  <TokenBadge
                    totalTokenCount={safeMessage.meta.totalTokenCount as number}
                    promptTokenCount={safeMessage.meta.promptTokenCount as number | undefined}
                    candidatesTokenCount={
                      safeMessage.meta.candidatesTokenCount as number | undefined
                    }
                    thoughtsTokenCount={safeMessage.meta.thoughtsTokenCount as number | undefined}
                  />
                </div>
              )}
            </div>

            {/* Actions - Hide for image_gen messages since ImageGenPreview has its own actions */}
            {!isLoading && !isEditing && safeMessage.meta?.type !== "image_gen" && (
              <MessageActions
                isBot={isBot}
                messageId={safeMessage.id}
                copied={copied}
                canRegenerate={canRegenerate}
                regenerating={regenerating}
                isSpeaking={isSpeaking}
                onCopy={handleCopyMessage}
                onEdit={!isBot ? () => setIsEditing(true) : undefined}
                onRegenerate={onRegenerate}
                onDelete={onDelete}
                onSpeak={isBot ? onSpeak : undefined}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  },
  (prev, next) => {
    return (
      prev.message === next.message &&
      prev.isLastAssistant === next.isLastAssistant &&
      prev.regenerating === next.regenerating &&
      prev.isStreaming === next.isStreaming &&
      prev.canRegenerate === next.canRegenerate &&
      prev.onRegenerate === next.onRegenerate &&
      prev.onEdit === next.onEdit &&
      prev.onDelete === next.onDelete &&
      prev.onImageRegenerate === next.onImageRegenerate &&
      prev.onImageEdit === next.onImageEdit &&
      prev.isSpeaking === next.isSpeaking &&
      prev.onSpeak === next.onSpeak
    );
  }
);

export default ChatBubble;
