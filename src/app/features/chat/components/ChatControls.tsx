// /app/features/chat/components/ChatControls.tsx
"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FolderOpen, AlertTriangle, Microscope } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

import ModelSelector from "./ModelSelector";
import ThinkingLevelSelector from "./ThinkingLevelSelector";
import LocalSamplingSettings from "./LocalSamplingSettings";
import InputForm from "./InputForm";
import FileManagerPanel from "./FileManagerPanel";
import GemQuickSwitch from "../../../features/gems/components/GemQuickSwitch";
import PersonaQuickSwitch from "../../../features/personas/components/PersonaQuickSwitch";
import ResearchAgentSelector from "../../../features/research/components/ResearchAgentSelector";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { type ThinkingLevel, modelSupportsThinkingUI } from "./hooks/useThinkingLevel";
import {
  modelSupportsWebSearch,
  isDeepSeekV32Model,
  modelSupportsDeepResearch,
  isStrataLocalModel,
} from "@/lib/core/modelRegistry";
import type { ResearchAgent } from "@/lib/features/research/types";

/** Gem info for display */
interface GemInfo {
  name: string;
  icon?: string | null;
  color?: string | null;
}

function ControlDivider() {
  return <div className="hidden md:block h-3 w-px bg-(--border) mx-1 shrink-0" />;
}

export interface ChatControlsProps {
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
  ensureConversationId,
  isSelfInitiatedUploadRef,
}: ChatControlsProps) {
  // Display value: show preview prompt when hovering, otherwise show actual input
  const displayValue = previewPrompt !== null ? previewPrompt : input;
  const isShowingPreview = previewPrompt !== null && previewPrompt !== "";
  const canWebSearch = modelSupportsWebSearch(currentModel);
  const canDeepResearch = modelSupportsDeepResearch(currentModel);
  const isV32 = isDeepSeekV32Model(currentModel);
  const isLocal = isStrataLocalModel(currentModel);

  const { t } = useLanguage();
  const tRecord = useMemo(
    () => new Proxy({} as Record<string, string>, { get: (_, prop: string) => t(prop) }),
    [t]
  );

  const [showFileManager, setShowFileManager] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);

  const controls: { key: string; node: React.ReactNode }[] = [
    {
      key: "model",
      node: (
        <div className="shrink-0 whitespace-nowrap">
          <ModelSelector
            currentModelId={currentModel}
            onSelectModel={handleModelChange}
            isModelAllowed={isModelAllowed}
            disabled={isStreaming || regenerating}
            expandDown={isLanding}
          />
        </div>
      ),
    },
    {
      key: "web",
      node: (
        <div className="flex items-center shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={canWebSearch ? toggleWebSearch : undefined}
            disabled={!canWebSearch}
            title={!canWebSearch ? t("webSearchNotSupported") : undefined}
            className={`shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-all duration-200 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] ${
              !canWebSearch
                ? "text-(--text-secondary) opacity-40 cursor-not-allowed"
                : webSearchEnabled
                  ? "text-(--accent) md:bg-(--control-bg-hover)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            {t("webSearchLabel")}{" "}
            {!canWebSearch
              ? t("webSearchOff")
              : webSearchEnabled
                ? t("webSearchOn")
                : t("webSearchOff")}
          </button>
          {isV32 && webSearchEnabled && (
            <span className="hidden md:inline text-xs text-(--warning)/80 font-medium ml-0.5 whitespace-nowrap">
              {t("webSearchPricingNote")}
            </span>
          )}
        </div>
      ),
    },
  ];

  if (canWebSearch && currentModel && currentModel.startsWith("gemini")) {
    controls.push({
      key: "always-search",
      node: (
        <button
          type="button"
          onClick={toggleAlwaysSearch}
          className={`shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-all duration-200 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] ${
            alwaysSearch
              ? "text-(--accent) md:bg-(--control-bg-hover)"
              : "text-(--text-secondary) hover:text-(--text-primary)"
          }`}
          title={t("alwaysSearchTooltip")}
        >
          {t("alwaysSearch")} {alwaysSearch ? t("webSearchOn") : t("webSearchOff")}
        </button>
      ),
    });
  }

  if (modelSupportsThinkingUI(currentModel)) {
    controls.push({
      key: "thinking",
      node: (
        <div className="shrink-0 whitespace-nowrap">
          <ThinkingLevelSelector
            thinkingLevel={thinkingLevel}
            setThinkingLevel={setThinkingLevel}
            currentModel={currentModel}
          />
        </div>
      ),
    });
  }

  if (isLocal) {
    controls.push({
      key: "local-sampling",
      node: (
        <div className="shrink-0 whitespace-nowrap">
          <LocalSamplingSettings
            currentModel={currentModel}
            thinkingLevel={thinkingLevel}
            disabled={isStreaming || regenerating}
          />
        </div>
      ),
    });
  }

  if (canDeepResearch) {
    controls.push({
      key: "deep-research",
      node: (
        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={deepResearchAllowed ? toggleDeepResearch : undefined}
            disabled={!deepResearchAllowed}
            title={!deepResearchAllowed ? t("deepResearchNotAllowed") : t("deepResearchDesc")}
            aria-pressed={deepResearchEnabled}
            className={`shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-all duration-200 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] ${
              !deepResearchAllowed
                ? "text-(--text-secondary) opacity-40 cursor-not-allowed"
                : deepResearchEnabled
                  ? "text-(--accent) md:bg-(--control-bg-hover)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Microscope className="w-3.5 h-3.5" />
            {t("deepResearch")}
          </button>
          {deepResearchEnabled && (
            <Popover open={showAgentSelector} onOpenChange={setShowAgentSelector}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 whitespace-nowrap text-xs font-semibold px-2.5 py-1 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/20 hover:bg-(--accent)/25 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95]"
                  title={t("deepResearchSelectAgent")}
                >
                  {selectedResearchAgent === "deep-research-max-preview-04-2026"
                    ? t("deepResearchAgentMax")
                    : t("deepResearchAgentDeep")}
                </button>
              </PopoverTrigger>
              {onResearchAgentChange && (
                <PopoverContent side="top" align="start" className="w-80 p-3">
                  <ResearchAgentSelector
                    selectedAgent={selectedResearchAgent || "deep-research-preview-04-2026"}
                    onSelect={(agent) => {
                      onResearchAgentChange(agent);
                      setShowAgentSelector(false);
                    }}
                  />
                </PopoverContent>
              )}
            </Popover>
          )}
        </div>
      ),
    });
  }

  controls.push({
    key: "gem",
    node: (
      <div className="shrink-0 whitespace-nowrap">
        <GemQuickSwitch currentGem={currentGem || null} conversationId={selectedConversationId} />
      </div>
    ),
  });

  controls.push({
    key: "persona",
    node: (
      <div className="shrink-0 whitespace-nowrap">
        <PersonaQuickSwitch
          currentPersona={currentPersona || null}
          conversationId={selectedConversationId}
        />
      </div>
    ),
  });

  if (currentGem && currentPersona) {
    controls.push({
      key: "conflict",
      node: (
        <div
          className="flex items-center justify-center p-1 rounded-full text-(--warning) bg-(--warning)/10 cursor-help shrink-0"
          title={
            t("conflictWarning") ||
            " Both GEM and Persona are active. If instructions conflict, GEM will be prioritized."
          }
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      ),
    });
  }

  if (fileCount > 0) {
    controls.push({
      key: "files",
      node: (
        <div className="relative shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setShowFileManager((v) => !v)}
            className={`shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-all duration-200 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] ${
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
              t={tRecord}
            />
          )}
        </div>
      ),
    });
  }

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
            : "pb-[calc(1.5rem+var(--sab,0px))] md:pb-6 shadow-2xl md:shadow-none fixed bottom-0 left-0 right-0 z-40 bg-(--surface)/95 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none md:static md:translate-y-0 pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))]"
        }
      `}
    >
      {/* Static Floating Controls Toolbar */}
      <div
        className={`flex items-center justify-start md:justify-center overflow-x-auto md:overflow-visible [scrollbar-width:none] max-w-full ${isLanding ? "mb-2 pt-0" : "mb-4 pt-4 md:pt-0"}`}
      >
        {/* Mobile: horizontal scroll without wrapping; Desktop: unified w-max pill so border always encloses all controls */}
        <div className="inline-flex w-max flex-nowrap items-center justify-center gap-2 @sm/chat:gap-3 @md/chat:gap-4 md:gap-0 md:rounded-full md:bg-(--control-bg) md:border md:border-(--control-border) md:p-1 md:shadow-lg">
          {controls.map((c, i) => (
            <React.Fragment key={c.key}>
              {i > 0 && <ControlDivider />}
              {c.node}
            </React.Fragment>
          ))}
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
            ensureConversationId={ensureConversationId}
            isSelfInitiatedUploadRef={isSelfInitiatedUploadRef}
          />
        </div>
      </div>

      {!isLanding && (
        <div className="mt-3 text-center">
          <p className="text-xs font-semibold text-(--text-secondary) tracking-widest uppercase hover:text-(--text-primary) transition-colors cursor-default">
            {t("aiDisclaimer")}
          </p>
        </div>
      )}
    </motion.div>
  );
}
