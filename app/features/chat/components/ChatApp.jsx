// /app/features/chat/components/ChatApp.jsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import AccessPendingScreen from "@/app/components/AccessPendingScreen";
import UpgradeModal from "@/app/components/UpgradeModal";
import DeleteConfirmModal from "@/app/components/DeleteConfirmModal";
import DashboardView from "./DashboardView";
import ChatControls from "./ChatControls";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";

import { useTheme } from "../hooks/useTheme";
import { useLanguage, LANGS } from "../hooks/useLanguage";
import { useConversation } from "../hooks/useConversation";
import { useGemStore } from "../../gems/stores/useGemStore";

import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";
import { useAllowedModels } from "./hooks/useAllowedModels";
import { useFileDragDrop } from "./hooks/useFileDragDrop";

import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  // Initialize Language ONCE from localStorage (moved from hook to avoid loops)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vikini-language");
      // Only set if stored is valid and DIFFERENT from current default
      if (stored && LANGS.includes(stored) && stored !== language) {
        setLanguage(stored);
      }
    }
  }, []); // Run ONCE on mount

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restrictedModel, setRestrictedModel] = useState(null);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);

  // Sidebar Collapsed State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Allowed Models (check access permissions)
  const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed); // [REFACTORED] Extracted hook

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

  // [REFACTORED] Extracted Drag & Drop Logic
  const { showFiles, setShowFiles, fileCount, setFileCount } = useFileDragDrop(attachmentsRef);

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
      // New Dashboard Descriptions
      "descSuggestionCode",
      "descSuggestionImage",
      "descSuggestionAnalyze",
      "descSuggestionChat",
      "descStatsTokenUsage",
      "descStatsNoData",
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

  // Auto-hide mobile controls logic (Tap to Toggle)
  const [showMobileControls, setShowMobileControls] = useState(true);

  // Restore Missing Functions
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
  }, [selectedConversationId, setFileCount, setShowFiles]);

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
      <div className="h-screen w-screen flex items-center justify-center bg-surface text-primary overflow-hidden">
        <div className="absolute inset-0 z-0 bg-surface-muted opacity-80" />
        <div className="relative animate-pulse flex flex-col items-center gap-6 z-10">
          <div className="h-16 w-16 rounded-2xl border border-[var(--control-border)] bg-control backdrop-blur-xl flex items-center justify-center text-3xl font-black shadow-2xl">
            V
          </div>
          <div className="text-[10px] tracking-[0.4em] text-[var(--text-secondary)] uppercase font-bold">
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
    <div className="h-screen w-screen text-primary overflow-hidden relative font-sans bg-surface">
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoClick={() => {
          setSelectedConversationId(null);
          closeMobileSidebar();
        }}
      />

      {/* Mobile Floating Trigger */}
      <FloatingMenuTrigger onClick={() => setMobileOpen((prev) => !prev)} />

      <div
        className={`h-full flex flex-col relative z-10 transition-all duration-300 ${
          sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"
        }`}
      >
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onThemeChange={toggleTheme}
          onToggleSidebar={toggleMobileSidebar}
          showMobileControls={showMobileControls} // Pass visibility prop
        />

        {/* Chat Area */}
        <div
          ref={scrollRef}
          onClick={() => {
            // 1. Do not toggle if on Dashboard (Landing) or Desktop
            if (showLanding || window.innerWidth >= 768) return;

            // 2. Do not toggle if user is selecting text
            // We use a small timeout to allow the selection to update after the click/mouseup
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) return;

              // 3. Toggle controls if no selection
              setShowMobileControls((prev) => !prev);
            }, 10);
          }}
          className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative pt-24 md:pt-0 pb-32 md:pb-0" // Added pt-24 (mobile header), pb-32 (mobile input)
        >
          {/* RA2 Theme Background Logos - Centered in Chat Content Area */}
          {(theme === "yuri" || theme === "allied" || theme === "soviet") && (
            <div
              className={`fixed top-0 left-0 right-0 bottom-0 z-[0] pointer-events-none transition-all duration-300 ${
                sidebarCollapsed ? "md:left-20" : "md:left-72 lg:left-80"
              }`}
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
            <div className="min-h-full flex flex-col justify-center py-4 animate-in fade-in zoom-in duration-500">
              <DashboardView
                onPromptSelect={(text) => {
                  setInput(text);
                  // Optional: auto focus input
                }}
                lastConversation={conversations?.[0]}
                onSelectConversation={handleSelectConversation}
              />
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

        {/* [REFACTORED] Extracted ChatControls */}
        <ChatControls
          currentModel={currentModel}
          handleModelChange={handleModelChange}
          isModelAllowed={isModelAllowed}
          t={t}
          showFiles={showFiles}
          setShowFiles={setShowFiles}
          fileCount={fileCount}
          setFileCount={setFileCount}
          webSearchEnabled={webSearchEnabled}
          toggleWebSearch={toggleWebSearch}
          alwaysSearch={alwaysSearch}
          toggleAlwaysSearch={toggleAlwaysSearch}
          currentGem={currentGem}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleStop={handleStop}
          disabled={creatingConversation || regenerating}
          isStreaming={isStreaming}
          regenerating={regenerating}
          creatingConversation={creatingConversation}
          streamingAssistant={streamingAssistant}
          attachmentsRef={attachmentsRef}
          selectedConversationId={selectedConversationId}
          showMobileControls={showMobileControls} // Pass visibility prop
        />
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
