"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { GitFork, Sparkles } from "lucide-react";
import ChatBubble from "./ChatBubble";
import type { FrontendConversation, FrontendMessage } from "../hooks/useConversation";
import type { ThinkingLevel } from "./hooks/useThinkingLevel";
import { ENABLE_VIRTUALIZED_CHAT } from "@/lib/utils/constants";
import {
  createSizeCache,
  computeVisibleRange,
  calculateVirtualPadding,
  computeScrollCompensation,
} from "@/lib/features/chat/virtualization";

export interface ChatMessagesAreaProps {
  renderedMessages: FrontendMessage[];
  currentConversation?: FrontendConversation | null;
  parentConversation?: FrontendConversation | null;
  contextMessagesCount: number;
  selectedConversationId: string | null;
  regenerating: boolean;
  isStreaming: boolean;
  streamingAssistant: string | null;
  streamingSources?: unknown[];
  streamingUrlContext?: unknown[];
  branchingMessageId: string | null;
  handleRegenerate: (m: FrontendMessage) => void;
  handleContinue: (m: FrontendMessage) => void;
  retrySave: (m: FrontendMessage) => void;
  handleEdit: (m: FrontendMessage, content: string) => void;
  openDeleteMessageModal: (messageId: string) => void;
  handleImageRegenerate: (message: FrontendMessage) => void;
  handleImageEdit: (message: FrontendMessage) => void;
  handleBranchMessage: (messageId: string) => void;
  setSelectedConversationIdAndUrl: (id: string) => void;
  tts: {
    speakMessage: (id: string, content: string) => void;
    isMessageSpeaking: (id: string) => boolean;
  };
  tRaw: (key: string) => string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  children?: React.ReactNode;
  lastGeneratedImage?: { url?: string; prompt?: string } | null;
  studioGeneratingStatus?: string;
  currentModel: string;
  lowerThinkingLevel?: ThinkingLevel | null;
  onRegenerateLowerThinking?: (targetMessage: FrontendMessage, newLevel: ThinkingLevel) => void;
}

export const ChatMessagesArea: React.FC<ChatMessagesAreaProps> = ({
  renderedMessages,
  currentConversation,
  parentConversation,
  contextMessagesCount,
  selectedConversationId,
  regenerating,
  isStreaming,
  streamingAssistant,
  streamingSources,
  streamingUrlContext,
  branchingMessageId,
  handleRegenerate,
  handleContinue,
  retrySave,
  handleEdit,
  openDeleteMessageModal,
  handleImageRegenerate,
  handleImageEdit,
  handleBranchMessage,
  setSelectedConversationIdAndUrl,
  tts,
  tRaw,
  scrollContainerRef,
  children,
  lastGeneratedImage,
  studioGeneratingStatus,
  currentModel,
  lowerThinkingLevel,
  onRegenerateLowerThinking,
}) => {
  // Size cache for virtualized list
  const sizeCache = useMemo(() => createSizeCache(100), [selectedConversationId]);

  // Virtualization scroll state tracking
  const [scrollState, setScrollState] = useState({ scrollTop: 0, viewportHeight: 800 });

  useEffect(() => {
    if (!ENABLE_VIRTUALIZED_CHAT) return;
    const container = scrollContainerRef?.current;
    if (!container) return;

    const onScrollOrResize = () => {
      setScrollState({
        scrollTop: container.scrollTop,
        viewportHeight: container.clientHeight || 800,
      });
    };

    onScrollOrResize();
    container.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      container.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [scrollContainerRef]);

  const lastAssistantIndex = useMemo(
    () => renderedMessages.map((m: FrontendMessage) => m.role).lastIndexOf("assistant"),
    [renderedMessages]
  );

  // Virtualization window calculation
  const { startIndex, endIndex } = useMemo(() => {
    if (!ENABLE_VIRTUALIZED_CHAT) {
      return { startIndex: 0, endIndex: Math.max(0, renderedMessages.length - 1) };
    }
    return computeVisibleRange(
      scrollState.scrollTop,
      scrollState.viewportHeight,
      renderedMessages.length,
      sizeCache,
      3
    );
  }, [scrollState.scrollTop, scrollState.viewportHeight, renderedMessages.length, sizeCache]);

  const { paddingTop, paddingBottom } = useMemo(() => {
    if (!ENABLE_VIRTUALIZED_CHAT) {
      return { paddingTop: 0, paddingBottom: 0 };
    }
    return calculateVirtualPadding(startIndex, endIndex, renderedMessages.length, sizeCache);
  }, [startIndex, endIndex, renderedMessages.length, sizeCache]);

  // Dynamic height measurement callback for virtualized items
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!ENABLE_VIRTUALIZED_CHAT) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const indexStr = target.dataset.index;
        if (indexStr === undefined) continue;
        const index = parseInt(indexStr, 10);
        if (Number.isNaN(index)) continue;

        const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (newHeight > 0) {
          const oldHeight = sizeCache.get(index);
          const delta = newHeight - oldHeight;
          if (Math.abs(delta) > 1) {
            sizeCache.set(index, newHeight);
            const compensation = computeScrollCompensation(index, startIndex, delta);
            if (compensation !== 0 && scrollContainerRef?.current) {
              scrollContainerRef.current.scrollTop += compensation;
            }
          }
        }
      }
    });

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [startIndex, sizeCache, scrollContainerRef]);

  const visibleMessages = useMemo(() => {
    if (!ENABLE_VIRTUALIZED_CHAT) {
      return renderedMessages.map((m, idx) => ({ message: m, actualIndex: idx }));
    }
    const result: Array<{ message: FrontendMessage; actualIndex: number }> = [];
    for (let i = startIndex; i <= endIndex && i < renderedMessages.length; i++) {
      const msg = renderedMessages[i];
      if (msg) {
        result.push({ message: msg, actualIndex: i });
      }
    }
    return result;
  }, [renderedMessages, startIndex, endIndex]);

  return (
    <div className="max-w-3xl mx-auto w-full py-8 space-y-2">
      {/* Origin Breadcrumb if conversation is a branch */}
      {currentConversation?.parentConversationId && (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--surface-elevated)/60 border border-(--border) text-xs text-(--text-secondary) w-fit backdrop-blur-sm animate-in fade-in duration-200">
          <GitFork className="w-3.5 h-3.5 rotate-180 text-(--accent)" />
          <span>{tRaw("branchedFrom") || "Được tách từ"}:</span>
          <button
            type="button"
            onClick={() => {
              if (currentConversation.parentConversationId) {
                setSelectedConversationIdAndUrl(currentConversation.parentConversationId);
              }
            }}
            className="font-medium text-(--accent) hover:underline truncate max-w-[240px] text-left"
            title={parentConversation?.title || tRaw("parentConversation") || "Cuộc hội thoại gốc"}
          >
            {parentConversation?.title || tRaw("parentConversation") || "Cuộc hội thoại gốc"}
          </button>
        </div>
      )}

      {/* Notice for preserved context readable by AI but hidden from user */}
      {contextMessagesCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--surface-elevated)/40 border border-(--border)/60 text-xs text-(--text-secondary) w-fit backdrop-blur-sm animate-in fade-in duration-200">
          <Sparkles className="w-3.5 h-3.5 text-(--accent)" />
          <span>
            {tRaw("priorContextForAi") ||
              "Các tin nhắn trước đó được lưu làm ngữ cảnh cho AI (ẩn trên màn hình)"}
          </span>
        </div>
      )}

      {/* Virtualization top spacer */}
      {ENABLE_VIRTUALIZED_CHAT && paddingTop > 0 && (
        <div style={{ height: `${paddingTop}px` }} aria-hidden="true" />
      )}

      {/* Rendered messages list */}
      {visibleMessages.map(({ message: m, actualIndex }) => {
        const isLastAI = m.role === "assistant" && actualIndex === lastAssistantIndex;
        return (
          <div
            key={m.id ?? actualIndex}
            data-index={actualIndex}
            ref={(el) => {
              if (ENABLE_VIRTUALIZED_CHAT) {
                if (el) itemRefs.current.set(actualIndex, el);
                else itemRefs.current.delete(actualIndex);
              }
            }}
          >
            <ChatBubble
              message={m}
              isLastAssistant={isLastAI}
              canRegenerate={m.role === "assistant"}
              onRegenerate={() => handleRegenerate(m)}
              onContinue={() => handleContinue(m)}
              onRetrySave={() => retrySave(m)}
              onEdit={handleEdit}
              onDelete={openDeleteMessageModal}
              onImageRegenerate={handleImageRegenerate}
              onImageEdit={handleImageEdit}
              regenerating={Boolean(regenerating && isLastAI && streamingAssistant === null)}
              isStreaming={Boolean(isStreaming && isLastAI && streamingAssistant === null)}
              lowerThinkingLevel={lowerThinkingLevel}
              onRegenerateLowerThinking={
                onRegenerateLowerThinking
                  ? (level) => onRegenerateLowerThinking(m, level)
                  : undefined
              }
              onSpeak={m.id ? () => tts.speakMessage(m.id!, m.content || "") : undefined}
              isSpeaking={m.id ? tts.isMessageSpeaking(m.id) : false}
              conversationId={selectedConversationId ?? undefined}
              onBranch={handleBranchMessage}
              isBranching={branchingMessageId === m.id}
            />
          </div>
        );
      })}

      {/* Virtualization bottom spacer */}
      {ENABLE_VIRTUALIZED_CHAT && paddingBottom > 0 && (
        <div style={{ height: `${paddingBottom}px` }} aria-hidden="true" />
      )}

      {/* Active Streaming Bubble */}
      {isStreaming && streamingAssistant !== null && (
        <ChatBubble
          message={{
            id: "streaming-assistant",
            role: "assistant",
            content: streamingAssistant || "",
            sources: streamingSources,
            urlContext: streamingUrlContext,
            meta: { model: currentConversation?.model || currentModel },
          }}
          isLastAssistant={true}
          isStreaming={true}
        />
      )}

      {/* Deep Research or other appended cards */}
      {children}

      {/* Generated image preview */}
      {lastGeneratedImage && (
        <div className="flex w-full flex-col gap-3 py-6">
          <div className="flex max-w-[95%] lg:max-w-[90%] gap-4 items-start">
            <ChatBubble
              message={{
                id: "temp-image",
                role: "assistant",
                content: lastGeneratedImage.url ? "" : studioGeneratingStatus || "",
                meta: {
                  type: "image_gen",
                  imageUrl: lastGeneratedImage.url,
                  prompt: lastGeneratedImage.prompt,
                },
              }}
              isLastAssistant={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessagesArea;
