// /app/features/chat/components/ChatControls.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen, AlertTriangle, Microscope } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

import ModelSelector from "./ModelSelector";
import ThinkingLevelSelector from "./ThinkingLevelSelector";
import InputForm from "./InputForm";
import FileManagerPanel from "./FileManagerPanel";
import GemQuickSwitch from "../../../features/gems/components/GemQuickSwitch";
import PersonaQuickSwitch from "../../../features/personas/components/PersonaQuickSwitch";
import ResearchAgentSelector from "../../../features/research/components/ResearchAgentSelector";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type ThinkingLevel, modelSupportsThinkingUI } from "./hooks/useThinkingLevel";
import {
  modelSupportsWebSearch,
  isDeepSeekV32Model,
  modelSupportsDeepResearch,
} from "@/lib/core/modelRegistry";
import type { ResearchAgent } from "@/lib/features/research/types";

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
  // Deep Research
  deepResearchEnabled: boolean;
  toggleDeepResearch: () => void;
  deepResearchAllowed: boolean;
  selectedResearchAgent?: ResearchAgent;
  onResearchAgentChange?: (agent: ResearchAgent) => void;
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
  // Deep Research
  deepResearchEnabled,
  toggleDeepResearch,
  deepResearchAllowed,
  selectedResearchAgent,
  onResearchAgentChange,
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
  const canDeepResearch = modelSupportsDeepResearch(currentModel);
  const isV32 = isDeepSeekV32Model(currentModel);

  const { t } = useLanguage();

  const [showFileManager, setShowFileManager] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ y: showMobileControls ? 0 : "100%" }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
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
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
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
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 ${
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
          {/* Deep Research Toggle - Gemini models only */}
          {canDeepResearch && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <button
                onClick={deepResearchAllowed ? toggleDeepResearch : undefined}
                disabled={!deepResearchAllowed}
                title={!deepResearchAllowed ? t("deepResearchNotAllowed") : t("deepResearchDesc")}
                aria-pressed={deepResearchEnabled}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 flex items-center gap-1 ${
                  !deepResearchAllowed
                    ? "text-(--text-secondary) opacity-40 cursor-not-allowed"
                    : deepResearchEnabled
                      ? "text-(--accent) md:bg-(--control-bg-hover)"
                      : "text-(--text-secondary) hover:text-(--text-primary)"
                }`}
              >
                <Microscope className="w-3 h-3" />
                {t("deepResearch")}
              </button>
              {/* Agent Selector Popover */}
              {deepResearchEnabled && (
                <div className="relative">
                  <button
                    onClick={() => setShowAgentSelector(!showAgentSelector)}
                    className="text-[10px] font-medium px-2 py-1 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/20 hover:bg-(--accent)/25 transition-colors"
                    title={t("deepResearchSelectAgent")}
                  >
                    {selectedResearchAgent === "deep-research-max-preview-04-2026"
                      ? t("deepResearchAgentMax")
                      : t("deepResearchAgentDeep")}
                  </button>
                  {showAgentSelector && onResearchAgentChange && (
                    <div className="absolute bottom-full left-0 mb-2 z-50">
                      <div className="fixed inset-0" onClick={() => setShowAgentSelector(false)} />
                      <div className="relative">
                        <ResearchAgentSelector
                          selectedAgent={selectedResearchAgent || "deep-research-preview-04-2026"}
                          onSelect={(agent) => {
                            onResearchAgentChange(agent);
                            setShowAgentSelector(false);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <GemQuickSwitch currentGem={currentGem || null} conversationId={selectedConversationId} />
          <PersonaQuickSwitch
            currentPersona={currentPersona || null}
            conversationId={selectedConversationId}
          />
          {currentGem && currentPersona && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div
                className="flex items-center justify-center p-1 rounded-full text-(--warning) bg-(--warning)/10 cursor-help"
                title={
                  t("conflictWarning") ||
                  "⚠️ Both GEM and Persona are active. If instructions conflict, GEM will be prioritized."
                }
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </>
          )}
          {fileCount > 0 && (
            <>
              <div className="hidden md:block h-3 w-px bg-(--border) mx-1" />
              <div className="relative">
                <button
                  onClick={() => setShowFileManager((v) => !v)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-colors rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 flex items-center gap-1.5 ${
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
