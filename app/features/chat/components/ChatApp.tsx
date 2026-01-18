"use client";

import { useSession, signIn, signOut } from "next-auth/react";

// UI Components
import ChatBubble from "./ChatBubble";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import AccessPendingScreen from "@/app/components/AccessPendingScreen";
import DashboardView from "./DashboardView";
import ChatControls from "./ChatControls";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import StreamErrorBanner from "./StreamErrorBanner";

import React, { useEffect, useRef, useMemo, useCallback, useState, lazy, Suspense } from "react";

import { useTheme } from "../hooks/useTheme";
import { LANGS, type SupportedLanguage } from "../hooks/useLanguage";
import {
  useConversation,
  type FrontendConversation,
  type FrontendMessage,
} from "../hooks/useConversation";
import { useGemStore } from "../../gems/stores/useGemStore";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";
import { useAllowedModels } from "./hooks/useAllowedModels";
import { useFileDragDrop } from "./hooks/useFileDragDrop";
import { useImageGenController } from "./hooks/useImageGenController";
import { useChatModals } from "./hooks/useChatModals";
import { useChatTranslations, useLanguage } from "./hooks/useChatTranslations";
import { useUrlSync } from "./hooks/useUrlSync";
import { type AttachmentsPanelRef } from "./AttachmentsPanel";

// Utils & Constants
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { logger } from "@/lib/utils/logger";
import { MODEL_IDS } from "@/lib/utils/constants";
import { toast } from "@/lib/store/toastStore";

// ============================================
// Type Definitions
// ============================================

/** Gem info attached to conversation */
interface GemInfo {
  name: string;
  icon: string | null;
  color: string | null;
}

/** Extended session user with rank */
interface SessionUser {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  rank?: string;
  id?: string;
}

// Lazy-loaded modals for code splitting
const UpgradeModal = lazy(() => import("@/app/components/UpgradeModal"));
const DeleteConfirmModal = lazy(() => import("@/app/components/DeleteConfirmModal"));
const EditImagePromptModal = lazy(() => import("@/app/components/EditImagePromptModal"));

// ============================================
// Main Component
// ============================================

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();
  const t = useChatTranslations();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Initialize Language ONCE from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vikini-language");
      if (stored && (LANGS as readonly string[]).includes(stored) && stored !== language) {
        setLanguage(stored as SupportedLanguage);
      }
    }
  }, [language, setLanguage]);

  // Mobile Sidebar State
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(true);

  // Allowed Models
  const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed);
  const isModelAllowed = useCallback(
    (modelId: string) => {
      if (modelsLoading) return true;
      if (allowedModelIds.size === 0) return true;
      return allowedModelIds.has(modelId);
    },
    [allowedModelIds, modelsLoading]
  );

  // Attachments
  const attachmentsRef = useRef<AttachmentsPanelRef | null>(null);
  const { showFiles, setShowFiles, fileCount, setFileCount } = useFileDragDrop(attachmentsRef);

  // Conversation Management
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

  // URL Sync Hook
  const { setSelectedConversationIdAndUrl, isRemixMode } = useUrlSync({
    selectedConversationId,
    setSelectedConversationId,
  });

  // Filter out Image Studio projects from chat list
  const filteredConversations = useMemo(() => {
    return (conversations || []).filter(
      (c: FrontendConversation) => c.model !== MODEL_IDS.IMAGE_STUDIO
    );
  }, [conversations]);

  // Web Search Preferences
  const {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
  } = useWebSearchPreference();

  // Chat Stream Controller
  const {
    renderedMessages,
    input,
    setInput,
    creatingConversation,
    loadingMessages,
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
    setMessages,
  } = useChatStreamController({
    isAuthed,
    selectedConversationId,
    setSelectedConversationId: setSelectedConversationIdAndUrl,
    createConversation,
    refreshConversations,
    renameConversationOptimistic,
    onWebSearchMeta: ({ enabled, available }: { enabled?: boolean; available?: boolean }) => {
      if (typeof enabled === "boolean") setServerWebSearch(enabled);
      if (typeof available === "boolean") setServerWebSearchAvailable(available);
    },
  });

  // Current Conversation & Model
  const currentConversation = useMemo(
    () => (conversations || []).find((c: FrontendConversation) => c?.id === selectedConversationId),
    [conversations, selectedConversationId]
  );
  const currentModel = currentConversation?.model || DEFAULT_MODEL;

  // Modal Management Hook
  const modals = useChatModals({
    conversations: conversations || [],
    selectedConversationId,
    deleteConversation,
    renameConversation,
    renameConversationOptimistic,
    refreshConversations,
    resetChatUI,
    setMessages,
    t,
  });

  // Image Generation Controller Hook
  const {
    lastGeneratedImage,
    showEditImageModal,
    setShowEditImageModal,
    editingImagePrompt,
    handleImageGen,
    handleImageRegenerate,
    handleImageEdit,
    confirmImageEdit,
  } = useImageGenController({
    selectedConversationId,
    createConversation,
    setSelectedConversationIdAndUrl,
    currentModel,
    t: tRaw,
  });

  // Remix prompt logic
  useEffect(() => {
    if (typeof window !== "undefined") {
      const remixPrompt = sessionStorage.getItem("remixPrompt");
      if (remixPrompt) {
        setInput(remixPrompt);
        sessionStorage.removeItem("remixPrompt");
      }
    }
  }, [setInput]);

  // Scroll handling
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current || isStreaming) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages.length, isStreaming, lastGeneratedImage]);

  // Model Change Handler
  const handleModelChange = useCallback(
    async (newModelId: string) => {
      if (!isModelAllowed(newModelId)) {
        const model = SELECTABLE_MODELS.find((m) => m.id === newModelId);
        modals.openUpgradeModal(model?.name || newModelId);
        return;
      }
      if (!selectedConversationId) return;
      try {
        patchConversationModel?.(selectedConversationId, newModelId);
        await setConversationModel?.(selectedConversationId, newModelId);
      } catch (e) {
        logger.error("Failed to change model:", e);
        toast.error(t.error);
      }
    },
    [
      isModelAllowed,
      selectedConversationId,
      patchConversationModel,
      setConversationModel,
      t.error,
      modals,
    ]
  );

  // Auto sign in
  useEffect(() => {
    if (!isAuthLoading && !isAuthed) signIn();
  }, [isAuthed, isAuthLoading]);

  // Reset file count when conversation changes
  useEffect(() => {
    setFileCount(0);
    setShowFiles(false);
  }, [selectedConversationId, setFileCount, setShowFiles]);

  // Gem applied callback
  const { setOnGemApplied } = useGemStore();
  useEffect(() => {
    setOnGemApplied((conversationId: string, gem: GemInfo | null) => {
      patchConversationGem(conversationId, gem);
      refreshConversations();
    });
    return () => {
      if (useGemStore.getState().setOnGemApplied) {
        useGemStore.getState().setOnGemApplied(null);
      }
    };
  }, [setOnGemApplied, patchConversationGem, refreshConversations]);

  // Memoized callbacks
  const memoizedOnSelectConversation = useCallback(
    (id: string | null) => {
      handleSelectConversation(id);
      closeMobileSidebar();
    },
    [handleSelectConversation, closeMobileSidebar]
  );

  const memoizedOnLanguageChange = useCallback(
    (lang: string) => setLanguage(lang as SupportedLanguage),
    [setLanguage]
  );

  // ============================================
  // Render: Loading State
  // ============================================
  if (isAuthLoading || !isAuthed) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface text-primary overflow-hidden">
        <div className="absolute inset-0 z-0 bg-surface-muted opacity-80" />
        <div className="relative animate-pulse flex flex-col items-center gap-6 z-10">
          <div className="h-16 w-16 rounded-2xl border border-(--control-border) bg-control backdrop-blur-xl flex items-center justify-center text-3xl font-black shadow-2xl">
            V
          </div>
          <div className="text-[10px] tracking-[0.4em] text-(--text-secondary) uppercase font-bold">
            {t.loading}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Access Pending
  // ============================================
  if (isAuthed && (session?.user as SessionUser | undefined)?.rank === "not_whitelisted") {
    return <AccessPendingScreen />;
  }

  // ============================================
  // Render: Main App
  // ============================================
  const showLanding = !isRemixMode && (!selectedConversationId || renderedMessages.length === 0);

  return (
    <div className="h-screen w-screen text-primary overflow-hidden relative font-sans bg-surface">
      <ToastContainer />
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      {/* Stream Error Banner */}
      <StreamErrorBanner error={streamError} onDismiss={clearStreamError} t={t} />

      {/* Sidebar */}
      <Sidebar
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={memoizedOnSelectConversation}
        onNewChat={() => {
          handleNewChat();
          closeMobileSidebar();
        }}
        onDeleteConversation={modals.openDeleteModal}
        onRenameChat={(id) => modals.openRenameModal(id, "")}
        onLogout={() => signOut()}
        t={t}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileSidebar}
        session={session}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoClick={() => {
          handleSelectConversation(null);
          closeMobileSidebar();
        }}
      />

      <FloatingMenuTrigger onClick={() => setMobileOpen((prev) => !prev)} />

      <div
        className={`h-full flex flex-col relative z-10 transition-all duration-300 ${sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"}`}
      >
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={memoizedOnLanguageChange}
          onToggleSidebar={toggleMobileSidebar}
          showMobileControls={showMobileControls}
        />

        <div
          ref={scrollRef}
          onClick={() => {
            if (showLanding || window.innerWidth >= 768) return;
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) return;
              setShowMobileControls((prev) => !prev);
            }, 10);
          }}
          className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative pt-24 md:pt-0 pb-32 md:pb-0 cursor-pointer md:cursor-auto"
        >
          {/* RA2 Theme Backgrounds */}
          {mounted && (theme === "yuri" || theme === "allied" || theme === "soviet") && (
            <div
              className={`fixed top-0 left-0 right-0 bottom-0 z-0 pointer-events-none transition-all duration-300 ${sidebarCollapsed ? "md:left-20" : "md:left-72 lg:left-80"}`}
              style={{
                backgroundImage: `url('/assets/themes/${theme}.png')`,
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

          {/* Chat Content */}
          {showLanding ? (
            <div className="min-h-full flex flex-col justify-center py-4 animate-in fade-in zoom-in duration-500">
              <DashboardView
                onPromptSelect={setInput}
                lastConversation={filteredConversations?.[0]}
                onSelectConversation={handleSelectConversation}
              />
            </div>
          ) : loadingMessages ? (
            <div className="max-w-3xl mx-auto w-full py-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              <div className="w-8 h-8 border-2 border-(--accent) border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-(--text-secondary)">{t.loading || "Loading..."}</span>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-8 space-y-2">
              {renderedMessages.map((m: FrontendMessage, idx: number) => {
                const isLastAI = m.role === "assistant" && idx === renderedMessages.length - 1;
                return (
                  <ChatBubble
                    key={m.id ?? idx}
                    message={m}
                    isLastAssistant={isLastAI}
                    canRegenerate={m.role === "assistant"}
                    onRegenerate={() => handleRegenerate(m)}
                    onEdit={handleEdit}
                    onDelete={modals.openDeleteMessageModal}
                    onImageRegenerate={handleImageRegenerate}
                    onImageEdit={handleImageEdit}
                    regenerating={regenerating && isLastAI}
                  />
                );
              })}

              {isStreaming && streamingAssistant !== null && (
                <ChatBubble
                  message={{
                    role: "assistant",
                    content: streamingAssistant || "",
                    sources: streamingSources,
                    urlContext: streamingUrlContext,
                  }}
                  isLastAssistant={true}
                />
              )}

              {lastGeneratedImage && (
                <div className="flex w-full flex-col gap-3 py-6">
                  <div className="flex max-w-[95%] lg:max-w-[90%] gap-4 items-start">
                    <ChatBubble
                      message={{
                        id: "temp-image",
                        role: "assistant",
                        content: lastGeneratedImage.url ? "" : t.studioGeneratingStatus,
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
          )}
        </div>

        <ChatControls
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleStop={handleStop}
          isStreaming={isStreaming}
          creatingConversation={creatingConversation}
          regenerating={regenerating}
          streamingAssistant={streamingAssistant}
          disabled={creatingConversation}
          webSearchEnabled={webSearchEnabled}
          toggleWebSearch={toggleWebSearch}
          alwaysSearch={alwaysSearch}
          toggleAlwaysSearch={toggleAlwaysSearch}
          currentModel={currentModel}
          handleModelChange={handleModelChange}
          isModelAllowed={isModelAllowed}
          currentGem={currentConversation?.gem}
          t={t}
          showFiles={showFiles}
          setShowFiles={setShowFiles}
          fileCount={fileCount}
          setFileCount={setFileCount}
          attachmentsRef={attachmentsRef}
          onImageGen={handleImageGen}
          selectedConversationId={selectedConversationId}
          showMobileControls={showMobileControls}
        />
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={modals.showUpgradeModal}
          onClose={modals.closeUpgradeModal}
          modelName={modals.restrictedModel || ""}
          t={t}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DeleteConfirmModal
          isOpen={modals.showDeleteModal}
          onCancel={modals.closeDeleteModal}
          onConfirm={modals.confirmDelete}
          t={t}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EditImagePromptModal
          isOpen={showEditImageModal}
          onClose={() => setShowEditImageModal(false)}
          initialPrompt={editingImagePrompt}
          onConfirm={confirmImageEdit}
          t={t}
        />
      </Suspense>

      {/* Rename Modal */}
      {modals.showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-(--text-primary) mb-4">
              {t.renameChat || "Rename Conversation"}
            </h3>
            <input
              type="text"
              value={modals.renameValue}
              onChange={(e) => modals.setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && modals.confirmRename()}
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-(--control-bg) border border-(--control-border) text-(--text-primary) placeholder:text-(--text-secondary) focus:outline-none focus:ring-2 focus:ring-(--accent)/50 mb-6"
              placeholder={t.renameChat || "Enter new title"}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={modals.closeRenameModal}
                className="px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
              >
                {t.cancel || "Cancel"}
              </button>
              <button
                onClick={modals.confirmRename}
                disabled={!modals.renameValue.trim()}
                className="px-4 py-2 bg-(--accent) text-(--surface) rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {t.save || "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Modal */}
      {modals.showDeleteMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-(--text-primary) mb-2">
              {t.modalDeleteTitle || "Delete Message?"}
            </h3>
            <p className="text-sm text-(--text-secondary) mb-6">
              {t.modalDeleteConfirm ||
                "Are you sure you want to delete this message? This action cannot be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={modals.closeDeleteMessageModal}
                className="px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
              >
                {t.cancel || "Cancel"}
              </button>
              <button
                onClick={modals.confirmDeleteMessage}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-all"
              >
                {t.modalDeleteButton || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
