// /app/features/chat/components/ChatControls.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

import ModelSelector from "./ModelSelector";
import ThinkingLevelSelector from "./ThinkingLevelSelector";
import InputForm from "./InputForm";
import FileManagerPanel from "./FileManagerPanel";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type ThinkingLevel, modelSupportsThinkingUI } from "./hooks/useThinkingLevel";
import { modelSupportsWebSearch, isDeepSeekV32Model } from "@/lib/core/modelRegistry";

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
}: ChatControlsProps) {
  // Display value: show preview prompt when hovering, otherwise show actual input
  const displayValue = previewPrompt !== null ? previewPrompt : input;
  const isShowingPreview = previewPrompt !== null && previewPrompt !== "";
  const canWebSearch = modelSupportsWebSearch(currentModel);
  const isV32 = isDeepSeekV32Model(currentModel);

  const { t } = useLanguage();

  const [showFileManager, setShowFileManager] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ y: showMobileControls ? 0 : "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`
        w-full max-w-4xl mx-auto px-4 md:px-6
        ${
          isLanding
            ? "relative z-40"
            : "pb-6 shadow-2xl md:shadow-none fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none md:static md:translate-y-0"
        }
      `}
    >
      {/* Static Floating Controls Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-center gap-2 ${isLanding ? "mb-2 pt-0" : "mb-4 pt-4 md:pt-0"}`}
      >
        {/* Mobile: no container border, each button is a separate chip */}
        {/* Desktop: unified toolbar with border */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0 md:rounded-full md:bg-(--control-bg) md:border md:border-(--control-border) md:p-1 md:shadow-lg">
          <ModelSelector
            currentModelId={currentModel}
            onSelectModel={handleModelChange}
            isModelAllowed={isModelAllowed}
            disabled={isStreaming || regenerating}
            expandDown={isLanding}
          />

          <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
          <button
            onClick={canWebSearch ? toggleWebSearch : undefined}
            disabled={!canWebSearch}
            title={!canWebSearch ? t("webSearchNotSupported") : undefined}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
              !canWebSearch
                ? "text-(--text-secondary) opacity-40 cursor-not-allowed"
                : webSearchEnabled
                  ? "text-(--accent) md:bg-(--control-bg-hover)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            WEB{" "}
            {!canWebSearch
              ? t("webSearchOff")
              : webSearchEnabled
                ? t("webSearchOn")
                : t("webSearchOff")}
          </button>
          {isV32 && webSearchEnabled && (
            <span className="hidden md:inline text-[8px] text-(--warning)/80 font-medium ml-0.5 whitespace-nowrap">
              {t("webSearchPricingNote")}
            </span>
          )}
          {canWebSearch && currentModel && currentModel.startsWith("gemini") && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <button
                onClick={toggleAlwaysSearch}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
                  alwaysSearch
                    ? "text-(--accent) md:bg-(--control-bg-hover)"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
                }`}
                title={t("alwaysSearchTooltip")}
              >
                {t("alwaysSearch")} {alwaysSearch ? t("webSearchOn") : t("webSearchOff")}
              </button>
            </>
          )}
          {/* Thinking Level Selector - For Gemini 2.5+ and 3+ models */}
          {modelSupportsThinkingUI(currentModel) && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <ThinkingLevelSelector
                thinkingLevel={thinkingLevel}
                setThinkingLevel={setThinkingLevel}
                currentModel={currentModel}
              />
            </>
          )}
          {currentGem && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-(--accent)/15 text-(--accent) border border-(--accent)/20"
                title={currentGem.name}
              >
                <span className="text-sm">{currentGem.icon}</span>
                <span className="max-w-[120px] truncate">{currentGem.name}</span>
              </div>
            </>
          )}
          {currentPersona && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-purple-500/15 text-purple-400 border border-purple-500/20"
                title={currentPersona.name}
              >
                <span className="text-sm">{currentPersona.icon || "🎭"}</span>
                <span className="max-w-[120px] truncate">{currentPersona.name}</span>
              </div>
            </>
          )}
          {fileCount > 0 && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div className="relative">
                <button
                  onClick={() => setShowFileManager((v) => !v)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 flex items-center gap-1.5 ${
                    showFileManager
                      ? "text-(--accent) md:bg-(--control-bg-hover)"
                      : "text-(--text-secondary) hover:text-(--accent)"
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {t("files")} ({fileCount})
                </button>
                {conversationId && (
                  <FileManagerPanel
                    conversationId={conversationId}
                    isOpen={showFileManager}
                    onClose={() => setShowFileManager(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

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
          />
        </div>
      </div>

      {!isLanding && (
        <div className="mt-3 text-center">
          <p className="text-[9px] font-bold text-(--text-secondary) tracking-widest uppercase hover:text-(--text-primary) transition-colors cursor-default">
            {t("aiDisclaimer")}
          </p>
        </div>
      )}
    </motion.div>
  );
}
