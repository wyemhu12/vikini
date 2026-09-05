// /app/features/chat/components/ChatBubble.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/utils/logger";
import type { FileItem } from "@/types/files";
import { useLanguage } from "../hooks/useLanguage";
import { extractThinking } from "./markdownConfig";
import { BubbleAvatar } from "./BubbleAvatar";
import { BubbleMarkdown } from "./BubbleMarkdown";
import { TypingDots, ThinkingBlock } from "./BubbleHelpers";
import MessageActions from "./MessageActions";
import SourceLinks from "./SourceLinks";
import ImageGenPreview from "./ImageGenPreview";
import TokenBadge from "./TokenBadge";
import { FileInMessage } from "./FileInMessage";

export interface MessageMeta {
  type?: string;
  imageUrl?: string;
  prompt?: string;
  attachment?: { url: string };
  fileIds?: string[];
  totalTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: string;
  content: string;
  id?: string;
  sources?: unknown[];
  urlContext?: unknown[];
  meta?: MessageMeta;
  [key: string]: unknown;
}

export interface ChatBubbleProps {
  message: ChatMessage;
  role?: string;
  content?: string;
  sources?: unknown[];
  urlContext?: unknown[];
  isLastAssistant?: boolean;
  canRegenerate?: boolean;
  regenerating?: boolean;
  isStreaming?: boolean;
  isSpeaking?: boolean;
  conversationId?: string;
  onRegenerate?: () => void;
  onEdit?: (message: ChatMessage, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onImageRegenerate?: (message: ChatMessage) => void;
  onImageEdit?: (message: ChatMessage) => void;
  onSpeak?: () => void;
}

const FileLightbox = dynamic(() => import("./FileLightbox"), { ssr: false });

export const ChatBubble = React.memo(
  function ChatBubble(props: ChatBubbleProps) {
    const { message, conversationId, isLastAssistant, isStreaming } = props;
    const { t } = useLanguage();

    const safeMessage = useMemo((): ChatMessage => {
      const b =
        message && typeof message === "object" ? message : { role: "assistant", content: "" };
      return {
        role: b.role || props.role || "assistant",
        content: b.content || props.content || "",
        sources: b.sources || props.sources || [],
        urlContext: b.urlContext || props.urlContext || [],
        id: b.id,
        meta: b.meta || {},
      };
    }, [message, props.role, props.content, props.sources, props.urlContext]);

    const isBot = safeMessage.role === "assistant";
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(safeMessage.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [copied, setCopied] = useState(false);
    const [lightboxFile, setLightboxFile] = useState<FileItem | null>(null);

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
      if (editContent.trim() !== safeMessage.content) props.onEdit?.(safeMessage, editContent);
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

    const deferredDisplayContent = useDeferredValue(displayContent);
    const hasContent = Boolean(displayContent?.trim()) || Boolean(thought?.trim());
    const isLoading = isBot && isLastAssistant && (props.regenerating || !hasContent);
    const showTyping =
      isLoading || (isBot && isLastAssistant && isStreamThinking && !displayContent.trim());

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`group flex w-full flex-col gap-3 py-6 ${isBot ? "" : "items-end"}`}
      >
        <div
          className={`flex max-w-[95%] lg:max-w-[90%] gap-4 ${isBot ? "items-start" : "flex-row-reverse items-start"}`}
        >
          <BubbleAvatar
            isBot={isBot}
            isLoading={isLoading}
            modelName={safeMessage.meta?.model as string | undefined}
          />

          <div
            className={`flex flex-col gap-2 ${isBot ? "items-start w-full min-w-0" : "items-end max-w-full"}`}
          >
            <div
              className={`relative rounded-2xl px-1 text-base leading-relaxed transition-colors ${
                isBot
                  ? "text-(--text-primary) w-full"
                  : "bg-(--accent) px-4 py-2.5 text-(--accent-foreground) shadow-lg"
              }`}
            >
              {isEditing ? (
                <div className="flex flex-col gap-2 w-full min-w-[60vw] md:min-w-[600px]">
                  <Textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      const sp = e.target.closest(".overflow-y-auto");
                      const st = sp?.scrollTop ?? 0;
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                      if (sp) sp.scrollTop = st;
                    }}
                    className="w-full bg-(--surface-elevated) text-(--text-primary) p-3 rounded-md outline-none resize-none overflow-hidden font-mono text-sm leading-6 border border-(--border) min-h-[40px] focus-visible:ring-1 focus-visible:ring-(--ring)"
                    rows={1}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-(--control-bg) hover:bg-(--control-bg-hover) rounded-md transition-colors text-(--text-secondary)"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-(--accent) text-(--accent-foreground) hover:brightness-110 rounded-md transition-colors shadow-sm"
                    >
                      {t("save")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col w-full overflow-hidden"
                  aria-busy={isStreaming && isLastAssistant}
                >
                  {thought && typeof thought === "string" && (
                    <ThinkingBlock content={thought} t={t} />
                  )}
                  {(!hasContent && isLoading) || (showTyping && !displayContent.trim()) ? (
                    <div role="status" aria-label="AI is typing">
                      <TypingDots />
                    </div>
                  ) : (
                    <>
                      {!isBot &&
                        safeMessage.meta?.fileIds &&
                        safeMessage.meta.fileIds.length > 0 &&
                        conversationId && (
                          <FileInMessage
                            conversationId={conversationId}
                            fileIds={safeMessage.meta.fileIds as string[]}
                            onClick={setLightboxFile}
                          />
                        )}
                      <BubbleMarkdown
                        content={deferredDisplayContent}
                        isBot={isBot}
                        isStreaming={isStreaming}
                        isLastAssistant={isLastAssistant}
                      />
                    </>
                  )}
                </div>
              )}

              {isBot &&
                safeMessage.meta?.type === "image_gen" &&
                (safeMessage.meta?.attachment?.url ? (
                  <ImageGenPreview
                    message={safeMessage}
                    onRegenerate={props.onImageRegenerate}
                    onEdit={props.onImageEdit}
                  />
                ) : (
                  <div className="mt-4 rounded-xl overflow-hidden border border-(--border) max-w-sm animate-pulse">
                    <div className="aspect-square bg-(--surface-muted) flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-(--text-secondary)/40" />
                    </div>
                    <div className="px-3 py-2 bg-(--surface-elevated) border-t border-(--border)">
                      <div className="h-3 bg-(--surface-muted) rounded w-3/4" />
                    </div>
                  </div>
                ))}

              {isBot && (safeMessage.sources?.length ?? 0) > 0 && (
                <SourceLinks sources={safeMessage.sources ?? []} />
              )}

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

            {!isLoading && !isEditing && safeMessage.meta?.type !== "image_gen" && (
              <MessageActions
                isBot={isBot}
                messageId={safeMessage.id}
                copied={copied}
                canRegenerate={props.canRegenerate}
                regenerating={props.regenerating}
                isSpeaking={props.isSpeaking}
                onCopy={handleCopyMessage}
                onEdit={!isBot ? () => setIsEditing(true) : undefined}
                onRegenerate={props.onRegenerate}
                onDelete={props.onDelete}
                onSpeak={isBot ? props.onSpeak : undefined}
              />
            )}
          </div>
        </div>

        {lightboxFile && <FileLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />}
      </motion.div>
    );
  },
  (p, n) =>
    p.message === n.message &&
    p.isLastAssistant === n.isLastAssistant &&
    p.regenerating === n.regenerating &&
    p.isStreaming === n.isStreaming &&
    p.canRegenerate === n.canRegenerate &&
    p.onRegenerate === n.onRegenerate &&
    p.onEdit === n.onEdit &&
    p.onDelete === n.onDelete &&
    p.onImageRegenerate === n.onImageRegenerate &&
    p.onImageEdit === n.onImageEdit &&
    p.isSpeaking === n.isSpeaking &&
    p.onSpeak === n.onSpeak &&
    p.conversationId === n.conversationId
);

export default ChatBubble;
