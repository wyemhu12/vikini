// /app/features/chat/components/ChatControls.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";

import ModelSelector from "./ModelSelector";
import AttachmentsPanel from "./AttachmentsPanel";
import InputForm from "./InputForm";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type AttachmentsPanelRef } from "./AttachmentsPanel";

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
        <div className="flex items-center rounded-full bg-[var(--control-bg)] border border-[var(--control-border)] p-1 shadow-lg">
          <ModelSelector
            currentModelId={currentModel}
            onSelectModel={handleModelChange}
            isModelAllowed={isModelAllowed}
            t={t}
            disabled={isStreaming || regenerating}
          />
          <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />
          <button
            onClick={() => setShowFiles(!showFiles)}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full flex items-center gap-1 ${
              showFiles || fileCount > 0
                ? "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            FILES{" "}
            {fileCount > 0 ? (
              <span className="text-[9px] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] px-1 rounded-sm ml-0.5 text-[var(--text-primary)]">
                {fileCount}
              </span>
            ) : (
              ""
            )}
          </button>
          <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />
          <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />
          {currentModel === "gemini-3-pro-research" ? (
            <button
              disabled
              className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full text-[var(--text-secondary)] bg-[var(--control-bg)] cursor-not-allowed border border-[var(--control-border)]"
              title="Research Mode always searches"
            >
              RESEARCH MODE (SEARCH ON)
            </button>
          ) : (
            <button
              onClick={toggleWebSearch}
              className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full ${
                webSearchEnabled
                  ? "text-[var(--accent)] bg-[var(--control-bg-hover)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              WEB {webSearchEnabled ? t.webSearchOn : t.webSearchOff}
            </button>
          )}
          {currentModel && currentModel.startsWith("gemini") && (
            <>
              <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />
              <button
                onClick={toggleAlwaysSearch}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full ${
                  alwaysSearch
                    ? "text-[var(--accent)] bg-[var(--control-bg-hover)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                title={t.alwaysSearchTooltip}
              >
                {t.alwaysSearch} {alwaysSearch ? t.webSearchOn : t.webSearchOff}
              </button>
            </>
          )}
          {currentGem && (
            <>
              <div className="h-3 w-[1px] bg-[var(--border)] mx-1" />
              <div className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 text-[var(--accent)]">
                {currentGem.icon} {currentGem.name}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input Box Wrapper */}
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-[var(--accent)] rounded-[2rem] opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur-lg" />
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
        <p className="text-[9px] font-bold text-[var(--text-secondary)] tracking-widest uppercase hover:text-[var(--text-primary)] transition-colors cursor-default">
          {t.aiDisclaimer}
        </p>
      </div>
    </motion.div>
  );
}
