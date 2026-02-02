// /app/features/chat/components/ChatControls.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";

import ModelSelector from "./ModelSelector";
import ThinkingLevelSelector from "./ThinkingLevelSelector";
import AttachmentsPanel, { type AttachmentsPanelRef } from "./AttachmentsPanel";
import InputForm from "./InputForm";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type ThinkingLevel, isGemini3Model } from "./hooks/useThinkingLevel";

/** Gem info for display */
interface GemInfo {
  name: string;
  icon?: string | null;
  color?: string | null;
}

interface ChatControlsProps {
  currentModel: string;
  handleModelChange: (model: string) => void;
  isModelAllowed: (model: string) => boolean;
  t: Record<string, string>;
  showFiles: boolean;
  setShowFiles: (show: boolean) => void;
  fileCount: number;
  setFileCount: (count: number) => void;
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  alwaysSearch: boolean;
  toggleAlwaysSearch: () => void;
  // Thinking Level
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  // UI state
  currentGem: GemInfo | null | undefined;
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  handleStop: () => void;
  isStreaming: boolean;
  regenerating: boolean;
  creatingConversation: boolean;
  streamingAssistant: string | null;
  attachmentsRef: React.RefObject<AttachmentsPanelRef | null>;
  selectedConversationId: string | null;
  showMobileControls?: boolean;
  disabled?: boolean;
  onImageGen: (prompt: string, options?: ImageGenOptions) => void;
  initialImageMode?: boolean; // For remix from Gallery
}

export default function ChatControls({
  currentModel,
  handleModelChange,
  isModelAllowed,
  t,
  // File panel state
  showFiles,
  setShowFiles,
  fileCount,
  setFileCount,
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
  input,
  setInput,
  handleSend,
  handleStop,
  onImageGen, // Updated prop logic flows through here
  isStreaming,
  regenerating,
  creatingConversation,
  streamingAssistant,
  // Refs & IDs
  attachmentsRef,
  selectedConversationId,
  showMobileControls = true, // Default to true if not passed (Desktop)
  initialImageMode = false, // For remix from Gallery
}: ChatControlsProps) {
  return (
    <motion.div
      initial={false}
      animate={{ y: showMobileControls ? 0 : "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`
        w-full shadow-2xl md:shadow-none max-w-4xl mx-auto pb-6 px-4 md:px-6 
        fixed bottom-0 left-0 right-0 z-40 
        bg-surface/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none
        md:static md:translate-y-0
      `}
    >
      {/* Static Floating Controls Toolbar - Minimalist */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 pt-4 md:pt-0">
        {/* Mobile: no container border, each button is a separate chip */}
        {/* Desktop: unified toolbar with border */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0 md:rounded-full md:bg-(--control-bg) md:border md:border-(--control-border) md:p-1 md:shadow-lg">
          <ModelSelector
            currentModelId={currentModel}
            onSelectModel={handleModelChange}
            isModelAllowed={isModelAllowed}
            t={t}
            disabled={isStreaming || regenerating}
          />
          <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
          <button
            onClick={() => setShowFiles(!showFiles)}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full flex items-center gap-1 bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
              showFiles || fileCount > 0
                ? "text-(--accent) md:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            FILES{" "}
            {fileCount > 0 ? (
              <span className="text-[9px] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] px-1 rounded-sm ml-0.5 text-(--text-primary)">
                {fileCount}
              </span>
            ) : (
              ""
            )}
          </button>
          <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
          <button
            onClick={toggleWebSearch}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
              webSearchEnabled
                ? "text-(--accent) md:bg-(--control-bg-hover)"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            WEB {webSearchEnabled ? t.webSearchOn : t.webSearchOff}
          </button>
          {currentModel && currentModel.startsWith("gemini") && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <button
                onClick={toggleAlwaysSearch}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
                  alwaysSearch
                    ? "text-(--accent) md:bg-(--control-bg-hover)"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
                }`}
                title={t.alwaysSearchTooltip}
              >
                {t.alwaysSearch} {alwaysSearch ? t.webSearchOn : t.webSearchOff}
              </button>
            </>
          )}
          {/* Thinking Level Selector - For ALL Gemini 3 models */}
          {isGemini3Model(currentModel) && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <ThinkingLevelSelector
                thinkingLevel={thinkingLevel}
                setThinkingLevel={setThinkingLevel}
                currentModel={currentModel}
                t={t}
              />
            </>
          )}
          {currentGem && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 text-(--accent)">
                {currentGem.icon} {currentGem.name}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input Box Wrapper */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-(--accent) rounded-4xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur-lg" />
        <div className="relative">
          <AttachmentsPanel
            ref={attachmentsRef}
            conversationId={selectedConversationId}
            disabled={creatingConversation || (isStreaming && !streamingAssistant) || regenerating}
            isExpanded={showFiles}
            onToggle={setShowFiles}
            onCountChange={setFileCount}
          />
          <InputForm
            input={input}
            onChangeInput={setInput}
            onSubmit={() => handleSend()}
            onStop={handleStop}
            onImageGen={onImageGen}
            disabled={creatingConversation || regenerating} // Only disable completely if creating new conv or regenerating
            isStreaming={isStreaming} // Pass streaming state
            t={t}
            conversationId={selectedConversationId}
            initialImageMode={initialImageMode}
          />
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-[9px] font-bold text-(--text-secondary) tracking-widest uppercase hover:text-(--text-primary) transition-colors cursor-default">
          {t.aiDisclaimer}
        </p>
      </div>
    </motion.div>
  );
}
