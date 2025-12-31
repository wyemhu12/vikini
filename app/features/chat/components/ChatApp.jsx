// /app/features/chat/components/ChatApp.jsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import InputForm from "./InputForm";
import AttachmentsPanel from "./AttachmentsPanel";
import AccessPendingScreen from "@/app/components/AccessPendingScreen";
import UpgradeModal from "@/app/components/UpgradeModal";
import DeleteConfirmModal from "@/app/components/DeleteConfirmModal";
import ModelSelector from "./ModelSelector";

import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";
import { useConversation } from "../hooks/useConversation";
import { useGemStore } from "../../gems/stores/useGemStore";

import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";

import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

// Inline hook to fetch allowed models for current user
function useAllowedModels(isAuthed) {
  const [allowedModelIds, setAllowedModelIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthed) {
      setAllowedModelIds(new Set());
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAllowedModels() {
      try {
        setLoading(true);
        const res = await fetch("/api/user/allowed-models");
        if (!res.ok) throw new Error("Failed to fetch allowed models");

        const data = await res.json();
        const allowed = data.allowed_models || [];

        if (cancelled) return;

        // Return Set of allowed model IDs for easy checking
        setAllowedModelIds(new Set(allowed));
      } catch (error) {
        console.warn("Error fetching allowed models:", error);
        // Fallback to allowing all models on error
        if (!cancelled) {
          setAllowedModelIds(new Set(SELECTABLE_MODELS.map((m) => m.id)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAllowedModels();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  return { allowedModelIds, loading };
}

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

  // File Panel State
  const [showFiles, setShowFiles] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restrictedModel, setRestrictedModel] = useState(null);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);

  // Allowed Models (check access permissions)
  const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed);
  // Always show all models, but some will be disabled
  // const AVAILABLE_MODELS = SELECTABLE_MODELS; // Unused

  // Function to check if a model is allowed
  const isModelAllowed = useCallback(
    (modelId) => {
      if (modelsLoading) return true; // Allow all while loading
      if (allowedModelIds.size === 0) return true; // Allow all if no restrictions
      return allowedModelIds.has(modelId);
    },
    [allowedModelIds, modelsLoading]
  );

  const attachmentsRef = useRef(null);
  const dragCounter = useRef(0);

  const t = useMemo(() => {
    const keys = [
      "appName",
      "whitelist",
      "whitelistOnly",
      "landingMessage",
      "exploreGems",
      "signOut",
      "newChat",
      "send",
      "placeholder",
      "refresh",
      "deleteAll",
      "logout",
      "modelSelector",
      "selectModel",
      "selectModel",
      "currentModel",
      "modelSelectorProviders",
      "modelSelectorService",
      "modelCategoryReasoning",
      "modelCategoryLowLatency",
      "modelSelectorModelsSuffix",
      "modelSelectorAvailableLater",
      "appliedGem",
      "appliedGemNone",
      "webSearch",
      "webSearchOn",
      "webSearchOff",
      "aiDisclaimer",
      "loading",
      "noConversations",
      "uploadFile",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-3-flash",
      "gemini-3-pro",
      "modelDescClaudeHaiku",
      "modelDescClaudeSonnet",
      "alwaysSearch",
      "alwaysSearchTooltip",
      "modelDescFlash25",
      "modelDescPro25",
      "modelDescFlash3",
      "modelDescPro3",
      "blueprint",
      "amber",
      "indigo",
      "charcoal",
      "gold",
      "red",
      "rose",
      "gemsTitle",
      "myGems",
      "premadeGems",
      "createGem",
      "editGem",
      "deleteGem",
      "saveGem",
      "cancel",
      "select",
      "error",
      "success",
      "renameChat",
      "deleteConfirm",
      "thinking",
      "regenerate",
      "edit",
      "save",
      "copy",
      "copied",
      // Modal translations
      "modalUpgradeTitle",
      "modalUpgradeRequestedModel",
      "modalUpgradeNoPermission",
      "modalUpgradeContactAdmin",
      "modalUpgradeGotIt",
      "modalDeleteTitle",
      "modalDeleteWarning",
      "modalDeleteConfirm",
      "modalDeleteButton",
    ];
    const result = {};
    keys.forEach((k) => {
      result[k] = tRaw(k);
    });
    return result;
  }, [tRaw, language]);

  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    refreshConversations,
    renameConversationOptimistic,
    renameConversation,
    deleteConversation,
    setConversationModel,
    patchConversationModel,
    patchConversationGem,
  } = useConversation();

  const {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
    serverHint: _serverHint,
  } = useWebSearchPreference();

  const {
    renderedMessages,
    input,
    setInput,
    creatingConversation,
    isStreaming,
    streamingAssistant,
    streamingSources,
    streamingUrlContext,
    regenerating,
    resetChatUI,
    handleNewChat,
    handleSelectConversation,
    handleSend,
    handleRegenerate,
    handleEdit,
    handleStop,
    streamError,
    clearStreamError,
  } = useChatStreamController({
    isAuthed,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    refreshConversations,
    renameConversationOptimistic,

    onWebSearchMeta: ({ enabled, available }) => {
      if (typeof enabled === "boolean") setServerWebSearch(enabled);
      if (typeof available === "boolean") setServerWebSearchAvailable(available);
    },
  });

  const scrollRef = useRef(null);

  // Auto scroll only when NOT streaming to avoid annoying jumps
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isStreaming) return; // Disable auto-scroll during streaming

    // Only scroll on initial load or new user message, not constantly during stream
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages.length, isStreaming]); // Depend on length change, not content

  // Global Drag & Drop Handler
  useEffect(() => {
    const handleDragEnter = (e) => {
      // Only care if dragging files
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        // dragCounter helps avoid flickering when entering child elements
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          if (!showFiles) setShowFiles(true);
        }
      }
    };

    const handleDragLeave = (e) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        dragCounter.current -= 1;
        // If we left the window (counter 0)
        if (dragCounter.current === 0) {
          // Collapse if empty, implying user cancelled drag-to-upload
          if (fileCount === 0) {
            setShowFiles(false);
          }
        }
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter.current = 0;

      if (e.dataTransfer?.files?.length > 0) {
        if (attachmentsRef.current) {
          attachmentsRef.current.uploadFiles(e.dataTransfer.files);
          // Ensure it stays open
          if (!showFiles) setShowFiles(true);
        }
      } else {
        // If dropped something else or nothing, revert?
        // Typically if dropping files, length > 0.
        if (fileCount === 0) setShowFiles(false);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [showFiles, fileCount]);

  const handleRenameFromSidebar = useCallback(
    async (id) => {
      const current = (conversations || []).find((c) => c?.id === id);
      const nextTitle = window.prompt(t.renameChat, current?.title || "");
      if (nextTitle) {
        renameConversationOptimistic(id, nextTitle.trim());
        await renameConversation(id, nextTitle.trim());
      }
    },
    [conversations, renameConversation, renameConversationOptimistic, t]
  );

  const handleDeleteFromSidebar = useCallback(async (id) => {
    // Show confirmation modal instead of browser confirm
    setConversationToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!conversationToDelete) return;

    try {
      await deleteConversation(conversationToDelete);
      if (conversationToDelete === selectedConversationId) {
        resetChatUI();
      }
      await refreshConversations();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    } finally {
      setShowDeleteModal(false);
      setConversationToDelete(null);
    }
  }, [
    conversationToDelete,
    deleteConversation,
    refreshConversations,
    resetChatUI,
    selectedConversationId,
  ]);

  const currentConversation = useMemo(
    () => (conversations || []).find((c) => c?.id === selectedConversationId),
    [conversations, selectedConversationId]
  );

  const currentModel = currentConversation?.model || DEFAULT_MODEL;
  const currentGem = currentConversation?.gem || null;

  const handleModelChange = useCallback(
    async (newModelId) => {
      // Check if user has access to this model FIRST
      if (!isModelAllowed(newModelId)) {
        // Find model name for display
        const model = SELECTABLE_MODELS.find((m) => m.id === newModelId);
        setRestrictedModel(model?.name || newModelId);
        setShowUpgradeModal(true);
        return; // Don't change model
      }

      // Only update conversation model if a conversation is selected
      if (!selectedConversationId) {
        // On landing page, model will be used when creating new conversation
        return;
      }

      // Update existing conversation's model
      try {
        patchConversationModel?.(selectedConversationId, newModelId);
        await setConversationModel?.(selectedConversationId, newModelId);
      } catch (e) {
        console.error(e);
      }
    },
    [selectedConversationId, setConversationModel, patchConversationModel, isModelAllowed]
  );

  useEffect(() => {
    if (!isAuthLoading && !isAuthed) signIn();
  }, [isAuthed, isAuthLoading]);

  // Reset file count when conversation changes (optimistic, panel will update it)
  useEffect(() => {
    setFileCount(0);
    setShowFiles(false);
  }, [selectedConversationId]);

  // Register callback for gem applied - optimistic update when gem changes
  const { setOnGemApplied } = useGemStore();
  useEffect(() => {
    setOnGemApplied((conversationId, gem) => {
      // Optimistically update the gem in local state for immediate UI feedback
      patchConversationGem(conversationId, gem);
      // Also refresh from server to ensure consistency
      refreshConversations();
    });
    return () => setOnGemApplied(null);
  }, [setOnGemApplied, patchConversationGem, refreshConversations]);

  if (isAuthLoading || !isAuthed) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#020617] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 bg-black/60" />
        <div className="relative animate-pulse flex flex-col items-center gap-6 z-10">
          <div className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-center text-3xl font-black shadow-2xl">
            V
          </div>
          <div className="text-[10px] tracking-[0.4em] text-white/30 uppercase font-bold">
            {t.loading}
          </div>
        </div>
      </div>
    );
  }

  // Check if user is not whitelisted (pending approval)
  if (isAuthed && session?.user?.rank === "not_whitelisted") {
    return <AccessPendingScreen />;
  }

  const showLanding = !selectedConversationId || renderedMessages.length === 0;

  return (
    <div className="h-screen w-screen bg-[#050505] text-neutral-100 overflow-hidden relative font-sans">
      {/* 🌌 Static Professional Background */}
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      {/* 🚨 Stream Error Toast */}
      {streamError && (
        <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-red-900/90 backdrop-blur-xl border border-red-500/50 rounded-xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-lg">⚠</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-red-200 mb-1">
                  {streamError.isTokenLimit
                    ? language === "vi"
                      ? "Giới hạn Token"
                      : "Token Limit Exceeded"
                    : language === "vi"
                      ? "Lỗi"
                      : "Error"}
                </h4>
                <p className="text-xs text-red-300/80 break-words">
                  {streamError.isTokenLimit && streamError.tokenInfo
                    ? language === "vi"
                      ? `Yêu cầu quá lớn cho model này. Giới hạn: ${streamError.tokenInfo.limit?.toLocaleString() || "?"} tokens, Yêu cầu: ${streamError.tokenInfo.requested?.toLocaleString() || "?"} tokens. Hãy thử giảm độ dài tin nhắn hoặc xóa bớt file đính kèm.`
                      : `Request too large for this model. Limit: ${streamError.tokenInfo.limit?.toLocaleString() || "?"} tokens, Requested: ${streamError.tokenInfo.requested?.toLocaleString() || "?"} tokens. Try reducing your message size or removing attachments.`
                    : streamError.message}
                </p>
              </div>
              <button
                onClick={clearStreamError}
                className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors"
              >
                <span className="text-red-300 text-xs">✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(id) => {
          handleSelectConversation(id);
          closeMobileSidebar();
        }}
        onNewChat={() => {
          handleNewChat();
          closeMobileSidebar();
        }}
        onDeleteConversation={handleDeleteFromSidebar}
        onRenameChat={handleRenameFromSidebar}
        onLogout={() => signOut()}
        t={t}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileSidebar}
        session={session}
      />

      <div className="h-full flex flex-col md:pl-80 relative z-10 transition-all duration-300">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onThemeChange={toggleTheme}
          onToggleSidebar={toggleMobileSidebar}
        />

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative">
          {/* RA2 Theme Background Logos - Centered in Chat Content Area */}
          {(theme === "yuri" || theme === "allied" || theme === "soviet") && (
            <div
              className="fixed top-0 left-0 md:left-80 right-0 bottom-0 z-[0] pointer-events-none"
              style={{
                backgroundImage:
                  theme === "yuri"
                    ? "url('/assets/themes/yuri.png')"
                    : theme === "allied"
                      ? "url('/assets/themes/allied.png')"
                      : "url('/assets/themes/soviet.png')",
                backgroundSize: theme === "allied" ? "38%" : "35%",
                backgroundPosition: "center center",
                backgroundRepeat: "no-repeat",
                opacity: theme === "soviet" ? 0.2 : theme === "yuri" ? 0.18 : 0.15,
                filter:
                  theme === "yuri"
                    ? "drop-shadow(0 0 60px rgba(168, 85, 247, 0.5))"
                    : theme === "allied"
                      ? "drop-shadow(0 0 80px rgba(56, 189, 248, 0.4))"
                      : "drop-shadow(0 0 60px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 100px rgba(251, 191, 36, 0.3))",
              }}
            />
          )}
          {showLanding ? (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
              <div className="mb-8 relative group">
                <div className="absolute inset-0 bg-[var(--primary)] blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity duration-700" />
                <div className="relative h-24 w-24 rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl flex items-center justify-center text-5xl font-black shadow-2xl text-white/90">
                  V
                </div>
              </div>
              <h2 className="max-w-xl text-center text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
                {t.landingMessage}
              </h2>
              <p className="text-[10px] font-bold tracking-[0.4em] text-white/30 uppercase">
                VIKINI INTELLIGENCE
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-8 space-y-2">
              {renderedMessages.map((m, idx) => {
                const isLastAI = m.role === "assistant" && idx === renderedMessages.length - 1;
                return (
                  <ChatBubble
                    key={m.id ?? idx}
                    message={m}
                    isLastAssistant={isLastAI}
                    canRegenerate={m.role === "assistant"}
                    onRegenerate={() => handleRegenerate(m)}
                    onEdit={handleEdit}
                    regenerating={regenerating && isLastAI}
                  />
                );
              })}
              {/* Animation Bubble: Show if streaming/creating OR if we have partial content */}
              {(streamingAssistant !== null || isStreaming || creatingConversation) && (
                <ChatBubble
                  message={{
                    role: "assistant",
                    content: streamingAssistant || "", // Pass empty string if null to trigger typing dots
                    sources: streamingSources,
                    urlContext: streamingUrlContext,
                  }}
                  isLastAssistant
                  canRegenerate={false}
                  onRegenerate={() => {}}
                  regenerating={regenerating}
                />
              )}
            </div>
          )}
        </div>

        {/* Input & Controls */}
        <div className="w-full max-w-4xl mx-auto pb-6 px-4 md:px-6">
          {/* Static Floating Controls Toolbar - Minimalist */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center rounded-full bg-[#0f1115] border border-white/5 p-1 shadow-lg">
              // Replace the whole native select block
              <ModelSelector
                currentModelId={currentModel}
                onSelectModel={handleModelChange}
                isModelAllowed={isModelAllowed}
                t={t}
                disabled={isStreaming || regenerating}
              />
              <div className="h-3 w-[1px] bg-white/10 mx-1" />
              <button
                onClick={() => setShowFiles(!showFiles)}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full flex items-center gap-1 ${
                  showFiles || fileCount > 0
                    ? "text-indigo-400 bg-indigo-500/10"
                    : "text-white/40 hover:text-white"
                }`}
              >
                FILES{" "}
                {fileCount > 0 ? (
                  <span className="text-[9px] bg-indigo-500/20 px-1 rounded-sm ml-0.5">
                    {fileCount}
                  </span>
                ) : (
                  ""
                )}
              </button>
              <div className="h-3 w-[1px] bg-white/10 mx-1" />
              <div className="h-3 w-[1px] bg-white/10 mx-1" />
              {currentModel === "gemini-3-pro-research" ? (
                <button
                  disabled
                  className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full text-blue-400 bg-blue-500/10 cursor-not-allowed border border-blue-500/30"
                  title="Research Mode always searches"
                >
                  RESEARCH MODE (SEARCH ON)
                </button>
              ) : (
                <button
                  onClick={toggleWebSearch}
                  className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full ${
                    webSearchEnabled
                      ? "text-[var(--primary)] bg-white/5"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  WEB {webSearchEnabled ? t.webSearchOn : t.webSearchOff}
                </button>
              )}
              {currentModel && currentModel.startsWith("gemini") && (
                <>
                  <div className="h-3 w-[1px] bg-white/10 mx-1" />
                  <button
                    onClick={toggleAlwaysSearch}
                    className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full ${
                      alwaysSearch
                        ? "text-emerald-400 bg-emerald-400/10"
                        : "text-white/40 hover:text-white"
                    }`}
                    title={t.alwaysSearchTooltip}
                  >
                    {t.alwaysSearch} {alwaysSearch ? t.webSearchOn : t.webSearchOff}
                  </button>
                </>
              )}
              {currentGem && (
                <>
                  <div className="h-3 w-[1px] bg-white/10 mx-1" />
                  <div className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 text-[var(--primary-light)]">
                    {currentGem.icon} {currentGem.name}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Input Box Wrapper */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-[var(--primary)] rounded-[2rem] opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur-lg" />
            <div className="relative">
              <AttachmentsPanel
                ref={attachmentsRef}
                conversationId={selectedConversationId}
                disabled={
                  creatingConversation || (isStreaming && !streamingAssistant) || regenerating
                }
                isExpanded={showFiles}
                onToggle={setShowFiles}
                onCountChange={setFileCount}
              />
              <InputForm
                input={input}
                onChangeInput={setInput}
                onSubmit={() => handleSend()}
                onStop={handleStop}
                disabled={creatingConversation || regenerating} // Only disable completely if creating new conv or regenerating
                isStreaming={isStreaming} // Pass streaming state
                t={t}
                conversationId={selectedConversationId}
              />
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-[9px] font-bold text-white/10 tracking-widest uppercase hover:text-white/30 transition-colors cursor-default">
              {t.aiDisclaimer}
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        modelName={restrictedModel}
        t={t}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setConversationToDelete(null);
        }}
        t={t}
      />
    </div>
  );
}
