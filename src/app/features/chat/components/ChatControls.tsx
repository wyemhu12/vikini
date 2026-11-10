// /app/features/chat/components/ChatControls.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";

import InputForm from "./InputForm";
import InputModelControls from "./InputModelControls";
import ComposerLeadingControls from "./ComposerLeadingControls";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type ThinkingLevel } from "./hooks/useThinkingLevel";

/** Gem info for display */
interface GemInfo {
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface ChatControlsProps {
  currentModel: string;
  handleModelChange: (model: string) => void;
  isModelAllowed: (model: string) => boolean;
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  alwaysSearch: boolean;
  toggleAlwaysSearch: () => void;
  // Thinking Level
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  // UI state
  currentGem: GemInfo | null | undefined;
  currentPersona: { name: string; icon: string | null; color: string | null } | null | undefined;
  input: string;
  setInput: (value: string) => void;
  handleSend: (text?: string, fileIds?: string[]) => void;
  handleStop: () => void;
  isStreaming: boolean;
  regenerating: boolean;
  creatingConversation: boolean;
  streamingAssistant: string | null;
  selectedConversationId: string | null;
  showMobileControls?: boolean;
  disabled?: boolean;
  onImageGen: (prompt: string, options?: ImageGenOptions) => void;
  initialImageMode?: boolean;
  onImageModeConsumed?: () => void;
  // Landing mode
  isLanding?: boolean;
  previewPrompt?: string | null;
  // File manager
  fileCount?: number;
  conversationId?: string | null;
  sentMessageFileIds?: string[];
  ensureConversationId?: () => Promise<string>;
  isSelfInitiatedUploadRef?: React.MutableRefObject<boolean>;
}

export default function ChatControls({
  currentModel,
  handleModelChange,
  isModelAllowed,
  // Web search state
  webSearchEnabled,
  toggleWebSearch,
  alwaysSearch,
  toggleAlwaysSearch,
  // Thinking Level
  thinkingLevel,
  setThinkingLevel,
  // UI state
  currentGem,
  currentPersona,
  input,
  setInput,
  handleSend,
  handleStop,
  onImageGen,
  isStreaming,
  regenerating,
  creatingConversation,
  streamingAssistant: _streamingAssistant,
  // IDs
  selectedConversationId,
  showMobileControls = true,
  initialImageMode = false,
  onImageModeConsumed,
  // Landing mode
  isLanding = false,
  previewPrompt = null,
  // File manager
  fileCount = 0,
  conversationId = null,
  sentMessageFileIds = [],
  ensureConversationId,
  isSelfInitiatedUploadRef,
}: ChatControlsProps) {
  // Display value: show preview prompt when hovering, otherwise show actual input
  const displayValue = previewPrompt !== null ? previewPrompt : input;
  const isShowingPreview = previewPrompt !== null && previewPrompt !== "";
  const isBusy = isStreaming || regenerating;

  const { t } = useLanguage();

  return (
    <motion.div
      initial={false}
      animate={{ y: showMobileControls ? 0 : "100%" }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={`
        w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 md:px-6
        ${
          isLanding
            ? "relative z-40"
            : "pt-3 md:pt-0 pb-[calc(1.5rem+var(--sab,0px))] md:pb-6 shadow-2xl md:shadow-none fixed bottom-0 left-0 right-0 z-40 bg-(--surface)/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none md:static md:translate-y-0 pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))]"
        }
      `}
    >
      {/* Input Box Wrapper */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-(--accent) rounded-4xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur-lg" />
        <div className="relative">
          <InputForm
            input={isShowingPreview ? displayValue : input}
            onChangeInput={setInput}
            onSubmit={(fileIds) => handleSend(undefined, fileIds)}
            onStop={handleStop}
            onImageGen={onImageGen}
            disabled={creatingConversation || regenerating} // Only disable completely if creating new conv or regenerating
            isStreaming={isStreaming} // Pass streaming state
            conversationId={selectedConversationId}
            initialImageMode={initialImageMode}
            onImageModeConsumed={onImageModeConsumed}
            isPreview={isShowingPreview}
            sentMessageFileIds={sentMessageFileIds}
            ensureConversationId={ensureConversationId}
            isSelfInitiatedUploadRef={isSelfInitiatedUploadRef}
            renderLeadingControls={({ openFilePicker, attachDisabled }) => (
              <ComposerLeadingControls
                currentModel={currentModel}
                webSearchEnabled={webSearchEnabled}
                toggleWebSearch={toggleWebSearch}
                alwaysSearch={alwaysSearch}
                toggleAlwaysSearch={toggleAlwaysSearch}
                thinkingLevel={thinkingLevel}
                setThinkingLevel={setThinkingLevel}
                currentGem={currentGem ?? null}
                currentPersona={currentPersona ?? null}
                conversationId={selectedConversationId}
                fileCount={fileCount}
                fileConversationId={conversationId}
                onSelectModel={handleModelChange}
                isModelAllowed={isModelAllowed}
                onAttach={openFilePicker}
                attachDisabled={attachDisabled}
                localSamplingDisabled={isBusy}
                expandDown={isLanding}
              />
            )}
            trailingControls={
              <InputModelControls
                currentModel={currentModel}
                onSelectModel={handleModelChange}
                isModelAllowed={isModelAllowed}
                thinkingLevel={thinkingLevel}
                setThinkingLevel={setThinkingLevel}
                disabled={isBusy}
                expandDown={isLanding}
              />
            }
          />
        </div>
      </div>

      {!isLanding && (
        <div className="mt-3 text-center">
          <p className="truncate text-xs text-(--faint) cursor-default">{t("aiDisclaimer")}</p>
        </div>
      )}
    </motion.div>
  );
}
