// /app/features/chat/components/ChatConversationView.tsx
"use client";

import React from "react";
import ChatMessagesArea from "./ChatMessagesArea";
import type { FrontendConversation } from "../hooks/useConversation";
import type { useTTS } from "../hooks/useTTS";
import type { useChatStreamController } from "./hooks/useChatStreamController";
import type { useImageGenController } from "./hooks/useImageGenController";
import type { useThinkingRegenerate } from "./hooks/useThinkingRegenerate";
import type { UseConversationBranchingReturn } from "./hooks/useConversationBranching";

interface ChatConversationViewProps {
  chat: ReturnType<typeof useChatStreamController>;
  imageGen: ReturnType<typeof useImageGenController>;
  thinking: ReturnType<typeof useThinkingRegenerate>;
  branching: UseConversationBranchingReturn;
  currentConversation: FrontendConversation | undefined;
  parentConversation: FrontendConversation | null | undefined;
  contextMessagesCount: number;
  selectedConversationId: string | null;
  currentModel: string;
  openDeleteMessageModal: (messageId: string) => void;
  setSelectedConversationIdAndUrl: (id: string) => void;
  tts: ReturnType<typeof useTTS>;
  tRaw: (key: string) => string;
  t: Record<string, string>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/** Active conversation: loading spinner and message list. */
export default function ChatConversationView({
  chat,
  imageGen,
  thinking,
  branching,
  t,
  ...rest
}: ChatConversationViewProps) {
  if (chat.loadingMessages) {
    return (
      <div className="max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto w-full py-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
        <div className="w-8 h-8 border-2 border-(--accent) border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-(--text-secondary)">{t.loading || "Loading..."}</span>
      </div>
    );
  }

  return (
    <ChatMessagesArea
      {...rest}
      renderedMessages={chat.renderedMessages}
      lowerThinkingLevel={thinking.lowerThinkingLevel}
      onRegenerateLowerThinking={thinking.handleRegenerateWithLowerThinking}
      regenerating={chat.regenerating}
      isStreaming={chat.isStreaming}
      streamingAssistant={chat.streamingAssistant}
      streamingThinking={chat.streamingThinking}
      streamingThinkingStats={chat.streamingThinkingStats}
      streamingLocalProgress={chat.streamingLocalProgress}
      streamingSources={chat.streamingSources}
      streamingRagSources={chat.streamingRagSources}
      streamingUrlContext={chat.streamingUrlContext}
      branchingMessageId={branching.branchingMessageId}
      handleBranchMessage={branching.handleBranchMessage}
      handleRegenerate={chat.handleRegenerate}
      handleContinue={chat.handleContinue}
      retrySave={chat.retrySave}
      handleEdit={chat.handleEdit}
      handleImageRegenerate={imageGen.handleImageRegenerate}
      handleImageEdit={imageGen.handleImageEdit}
      lastGeneratedImage={imageGen.lastGeneratedImage}
      studioGeneratingStatus={t.studioGeneratingStatus}
    />
  );
}
