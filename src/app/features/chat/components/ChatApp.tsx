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
import ProjectChatView from "../../projects/components/ProjectChatView";
import ChatDeepResearch from "./ChatDeepResearch";
import ChatModalsSection from "./ChatModalsSection";

import React, { useEffect, useMemo, useCallback, useState, lazy, Suspense } from "react";

import { useTheme } from "../hooks/useTheme";
import { LANGS, type SupportedLanguage } from "../hooks/useLanguage";
import {
  useConversation,
  type FrontendConversation,
  type FrontendMessage,
} from "../hooks/useConversation";
import { useGemStore } from "../../gems/stores/useGemStore";
import { usePersonaStore } from "../../personas/stores/usePersonaStore";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useDeepResearchMode } from "./hooks/useDeepResearchMode";
import { useThinkingLevel } from "./hooks/useThinkingLevel";

import ResearchReportPanel from "../../research/components/ResearchReportPanel";
import ResearchThinkingPanel from "../../research/components/ResearchThinkingPanel";
import EditPlanModal from "../../research/components/EditPlanModal";
import { useChatStreamController } from "./hooks/useChatStreamController";
import { useAllowedModels } from "./hooks/useAllowedModels";
import { useImageGenController } from "./hooks/useImageGenController";
import { useChatModals } from "./hooks/useChatModals";
import { useChatTranslations, useLanguage } from "./hooks/useChatTranslations";
import { useUrlSync } from "./hooks/useUrlSync";
import { useTTS } from "../hooks/useTTS";
import { useChatScroll } from "./hooks/useChatScroll";

// Utils & Constants
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { logger } from "@/lib/utils/logger";
import { MODEL_IDS } from "@/lib/utils/constants";
import { toast } from "@/lib/store/toastStore";
import { useProjectStore } from "@/lib/store/projectStore";
import { useFiles } from "@/lib/features/files/useFiles";

// ============================================
// Type Definitions
// ============================================

/** Gem info attached to conversation */
interface GemInfo {
  name: string;
  icon: string | null;
  color: string | null;
}

/** Persona info attached to conversation */
interface PersonaInfo {
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

  // Image Mode State (activated from DashboardView)
  const [pendingImageMode, setPendingImageMode] = useState(false);
  const activateImageMode = useCallback(() => setPendingImageMode(true), []);

  // Prompt Preview State (hover suggestion → preview in input)
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
  const handlePromptPreview = useCallback((prompt: string | null) => {
    setPreviewPrompt(prompt);
  }, []);

  // Project State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const { projects } = useProjectStore();

  // Allowed Models & Features
  const { allowedModelIds, features, loading: modelsLoading } = useAllowedModels(isAuthed);
  const isModelAllowed = useCallback(
    (modelId: string) => {
      if (modelsLoading) return true;
      if (allowedModelIds.size === 0) return true;
      return allowedModelIds.has(modelId);
    },
    [allowedModelIds, modelsLoading]
  );

  // Landing Page Model State
  const [landingModel, setLandingModel] = useState<string>(DEFAULT_MODEL);

  // Initialize Landing Model
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem("vikini-landing-model");
      if (savedModel && SELECTABLE_MODELS.some((m) => m.id === savedModel)) {
        setLandingModel(savedModel);
      }
    }
  }, []);

  // Conversation Management
  const {
    conversations,
    personalConversations,
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
    patchConversationPersona,
    creatingConversation: isCreatingChatMode,
  } = useConversation();

  // URL Sync Hook
  const { setSelectedConversationIdAndUrl, isRemixMode } = useUrlSync({
    selectedConversationId,
    setSelectedConversationId,
  });

  // Filter: only personal chats (no project) and exclude Image Studio
  const filteredConversations = useMemo(() => {
    return (personalConversations || []).filter(
      (c: FrontendConversation) => c.model !== MODEL_IDS.IMAGE_STUDIO
    );
  }, [personalConversations]);

  // Web Search Preferences
  const {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
  } = useWebSearchPreference();

  // Deep Research Mode
  const {
    isDeepResearchMode,
    enterDeepResearch,
    exitDeepResearch,
    currentTask,
    pendingQuery,
    isApproving,
    selectedAgent,
    setSelectedAgent,
    startResearch,
    approvePlan,
    cancelResearch,
    isReportPanelOpen,
    openReportPanel,
    closeReportPanel,
    isThinkingPanelOpen,
    openThinkingPanel,
    closeThinkingPanel,
  } = useDeepResearchMode();

  // Edit plan modal state
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);

  // Feature permission
  const deepResearchAllowed = features?.deep_research === true;

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
    createConversation: useCallback(
      () => createConversation({ model: landingModel }),
      [createConversation, landingModel]
    ),
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
  const currentModel = currentConversation?.model || landingModel;

  // Intercept send for Deep Research
  const handleMessageSend = useCallback(
    (text?: string, fileIds?: string[]) => {
      const finalQuery = text || input;
      if (isDeepResearchMode) {
        if (finalQuery.trim()) {
          setInput("");
          startResearch(
            finalQuery,
            selectedConversationId || undefined,
            selectedProjectId || undefined,
            (currentConversation as { gemId?: string })?.gemId || undefined
          ).catch((e) => toast.error(e.message || "Failed to start research"));
        }
      } else {
        handleSend(text, fileIds);
      }
    },
    [
      isDeepResearchMode,
      startResearch,
      handleSend,
      selectedConversationId,
      selectedProjectId,
      currentConversation,
      input,
      setInput,
    ]
  );

  // File count for file manager button
  const { fileCount } = useFiles(selectedConversationId);

  // Compute which files have already been sent in messages (survives reload)
  const sentMessageFileIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of renderedMessages) {
      if (m.role === "user" && m.meta) {
        const meta = m.meta as Record<string, unknown>;
        const fIds = meta["fileIds"];
        if (Array.isArray(fIds)) {
          ids.push(...(fIds as string[]));
        }
      }
    }
    return ids;
  }, [renderedMessages]);

  // Thinking Level Preference (Gemini 3 Thinking models)
  const { thinkingLevel, setThinkingLevel } = useThinkingLevel(currentModel);

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
  });

  // TTS Hook for reading AI responses aloud
  const tts = useTTS();

  // Image Generation Controller Hook
  const {
    lastGeneratedImage,
    setLastGeneratedImage,
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
    onSuccess: () => {
      // Reload messages to show the generated image
      if (selectedConversationId) {
        void handleSelectConversation(selectedConversationId);
      }
      // Clear temporary state
      setLastGeneratedImage(null);
    },
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

  // Smart Auto-Scroll (extracted hook)
  const { scrollRef, handleScroll, handleTouchStart, handleTouchEnd } = useChatScroll({
    isStreaming,
    streamingAssistant,
    renderedMessagesLength: renderedMessages.length,
    lastGeneratedImage,
  });

  // Model Change Handler
  const handleModelChange = useCallback(
    async (newModelId: string) => {
      if (!isModelAllowed(newModelId)) {
        const model = SELECTABLE_MODELS.find((m) => m.id === newModelId);
        modals.openUpgradeModal(model?.name || newModelId);
        return;
      }
      if (!selectedConversationId) {
        setLandingModel(newModelId);
        if (typeof window !== "undefined") {
          localStorage.setItem("vikini-landing-model", newModelId);
        }
        return;
      }
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
    if (!isAuthLoading && !isAuthed) void signIn();
  }, [isAuthed, isAuthLoading]);

  // Gem applied callback
  const { setOnGemApplied } = useGemStore();
  useEffect(() => {
    setOnGemApplied((conversationId: string, gem: GemInfo | null) => {
      patchConversationGem(conversationId, gem);
      void refreshConversations();
    });
    return () => {
      if (useGemStore.getState().setOnGemApplied) {
        useGemStore.getState().setOnGemApplied(null);
      }
    };
  }, [setOnGemApplied, patchConversationGem, refreshConversations]);

  // Persona applied callback
  const { setOnPersonaApplied } = usePersonaStore();
  useEffect(() => {
    setOnPersonaApplied((conversationId: string, persona: PersonaInfo | null) => {
      patchConversationPersona(conversationId, persona);
      void refreshConversations();
    });
    return () => {
      if (usePersonaStore.getState().setOnPersonaApplied) {
        usePersonaStore.getState().setOnPersonaApplied(null);
      }
    };
  }, [setOnPersonaApplied, patchConversationPersona, refreshConversations]);

  // Memoized callbacks
  const memoizedOnSelectConversation = useCallback(
    (id: string | null) => {
      void handleSelectConversation(id);
      closeMobileSidebar();
    },
    [handleSelectConversation, closeMobileSidebar]
  );

  // Sidebar-specific memoized callbacks (prevent re-renders via React.memo)
  const memoizedOnNewChat = useCallback(() => {
    void handleNewChat();
    closeMobileSidebar();
  }, [handleNewChat, closeMobileSidebar]);

  // Extract stable refs from modals (these are useCallback-wrapped, so stable)
  const { openRenameModal, openDeleteModal } = modals;

  const memoizedOnRenameChat = useCallback(
    (id: string) => openRenameModal(id, ""),
    [openRenameModal]
  );

  const memoizedOnLogout = useCallback(() => signOut(), []);

  const memoizedOnToggleCollapse = useCallback(() => setSidebarCollapsed((prev) => !prev), []);

  const memoizedOnLogoClick = useCallback(() => {
    void handleSelectConversation(null);
    setSelectedProjectId(null);
    closeMobileSidebar();
  }, [handleSelectConversation, closeMobileSidebar]);

  const memoizedOnCreateProjectChat = useCallback(
    async (projectId: string) => {
      const conv = await createConversation({ title: "", projectId, model: landingModel });
      if (conv) {
        setSelectedConversationIdAndUrl(conv.id);
        setSelectedProjectId(null);
        closeMobileSidebar();
      }
    },
    [createConversation, setSelectedConversationIdAndUrl, closeMobileSidebar]
  );

  const memoizedOnSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      void handleSelectConversation(null);
      closeMobileSidebar();
    },
    [handleSelectConversation, closeMobileSidebar]
  );

  const memoizedOnRenameProjectConversation = useCallback(
    (id: string) => openRenameModal(id, ""),
    [openRenameModal]
  );

  const memoizedOnDeleteProjectConversation = useCallback(
    (id: string) => openDeleteModal(id),
    [openDeleteModal]
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
  const showProjectView = selectedProjectId && !selectedConversationId;
  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;
  const projectConversations = selectedProjectId
    ? conversations.filter((c) => c.projectId === selectedProjectId)
    : [];
  const hasActiveResearch = isDeepResearchMode && (currentTask != null || pendingQuery != null);
  const showLanding =
    !isRemixMode &&
    !showProjectView &&
    !hasActiveResearch &&
    (!selectedConversationId || renderedMessages.length === 0);

  return (
    <div className="h-screen w-screen text-primary overflow-hidden relative font-sans bg-surface">
      <ToastContainer />
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      {/* Stream Error Banner */}
      <StreamErrorBanner error={streamError} onDismiss={clearStreamError} />

      {/* Sidebar */}
      <Sidebar
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={memoizedOnSelectConversation}
        onNewChat={memoizedOnNewChat}
        onDeleteConversation={openDeleteModal}
        onRenameChat={memoizedOnRenameChat}
        onLogout={memoizedOnLogout}
        t={t}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileSidebar}
        session={session}
        collapsed={sidebarCollapsed}
        onToggleCollapse={memoizedOnToggleCollapse}
        onLogoClick={memoizedOnLogoClick}
        allConversations={conversations}
        onCreateProjectChat={memoizedOnCreateProjectChat}
        onSelectProject={memoizedOnSelectProject}
        onRenameProjectConversation={memoizedOnRenameProjectConversation}
        onDeleteProjectConversation={memoizedOnDeleteProjectConversation}
        isCreatingChat={isCreatingChatMode}
      />

      <FloatingMenuTrigger onClick={() => setMobileOpen((prev) => !prev)} />

      <div
        className={`h-full flex flex-col relative z-10 transition-[padding] duration-300 ${sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"}`}
      >
        <HeaderBar onToggleSidebar={toggleMobileSidebar} showMobileControls={showMobileControls} />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (showLanding || window.innerWidth >= 768) return;
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) return;
              setShowMobileControls((prev) => !prev);
            }, 10);
          }}
          className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative pt-24 md:pt-0 pb-32 md:pb-0 cursor-pointer md:cursor-auto"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {/* RA2 Theme Backgrounds */}
          {mounted && (theme === "yuri" || theme === "allied" || theme === "soviet") && (
            <div
              className={`fixed top-0 left-0 right-0 bottom-0 z-0 pointer-events-none transition-[left] duration-300 ${sidebarCollapsed ? "md:left-20" : "md:left-72 lg:left-80"}`}
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
          {showProjectView && selectedProject ? (
            <ProjectChatView
              project={selectedProject}
              conversations={projectConversations}
              onNewChat={async () => {
                const conv = await createConversation({
                  title: "",
                  projectId: selectedProjectId!,
                  model: landingModel,
                });
                if (conv) {
                  setSelectedConversationIdAndUrl(conv.id);
                  setSelectedProjectId(null);
                }
              }}
              onSelectConversation={(id) => {
                void handleSelectConversation(id);
                setSelectedProjectId(null);
              }}
              onOpenSettings={() => {
                setShowProjectSettingsModal(true);
              }}
              onRenameConversation={(id) => {
                modals.openRenameModal(id, "");
              }}
              onDeleteConversation={(id) => {
                modals.openDeleteModal(id);
              }}
            />
          ) : showLanding ? (
            <div className="min-h-full flex flex-col items-center justify-center pb-[25vh] animate-in fade-in zoom-in duration-500">
              <DashboardView
                onPromptSelect={setInput}
                onPromptPreview={handlePromptPreview}
                onActivateImageMode={activateImageMode}
              >
                {/* ChatControls rendered between greeting and chips */}
                <ChatControls
                  input={input}
                  setInput={setInput}
                  handleSend={handleMessageSend}
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
                  deepResearchEnabled={isDeepResearchMode}
                  toggleDeepResearch={isDeepResearchMode ? exitDeepResearch : enterDeepResearch}
                  deepResearchAllowed={deepResearchAllowed}
                  thinkingLevel={thinkingLevel}
                  setThinkingLevel={setThinkingLevel}
                  currentModel={currentModel}
                  handleModelChange={handleModelChange}
                  isModelAllowed={isModelAllowed}
                  currentGem={currentConversation?.gem}
                  currentPersona={currentConversation?.persona}
                  onImageGen={handleImageGen}
                  selectedConversationId={selectedConversationId}
                  showMobileControls={showMobileControls}
                  initialImageMode={pendingImageMode || isRemixMode}
                  onImageModeConsumed={() => setPendingImageMode(false)}
                  isLanding={true}
                  previewPrompt={previewPrompt}
                  fileCount={fileCount}
                  conversationId={selectedConversationId}
                  sentMessageFileIds={sentMessageFileIds}
                />
              </DashboardView>
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
                    isStreaming={isStreaming && isLastAI}
                    onSpeak={m.id ? () => tts.speakMessage(m.id!, m.content || "") : undefined}
                    isSpeaking={m.id ? tts.isMessageSpeaking(m.id) : false}
                    conversationId={selectedConversationId ?? undefined}
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

              {/* Deep Research integration (extracted component) */}
              {isDeepResearchMode && (currentTask || pendingQuery) && (
                <ChatDeepResearch
                  currentTask={currentTask}
                  pendingQuery={pendingQuery}
                  isApproving={isApproving}
                  approvePlan={approvePlan}
                  cancelResearch={cancelResearch}
                  openReportPanel={openReportPanel}
                  openThinkingPanel={openThinkingPanel}
                  onEditPlan={() => setIsEditPlanOpen(true)}
                  t={t}
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

        {/* ChatControls at bottom - only when NOT landing and NOT project view */}
        {!showProjectView && !showLanding && (
          <ChatControls
            input={input}
            setInput={setInput}
            handleSend={handleMessageSend}
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
            deepResearchEnabled={isDeepResearchMode}
            toggleDeepResearch={isDeepResearchMode ? exitDeepResearch : enterDeepResearch}
            deepResearchAllowed={deepResearchAllowed}
            selectedResearchAgent={selectedAgent}
            onResearchAgentChange={setSelectedAgent}
            thinkingLevel={thinkingLevel}
            setThinkingLevel={setThinkingLevel}
            currentModel={currentModel}
            handleModelChange={handleModelChange}
            isModelAllowed={isModelAllowed}
            currentGem={currentConversation?.gem}
            currentPersona={currentConversation?.persona}
            onImageGen={handleImageGen}
            selectedConversationId={selectedConversationId}
            showMobileControls={showMobileControls}
            initialImageMode={pendingImageMode || isRemixMode}
            onImageModeConsumed={() => setPendingImageMode(false)}
            previewPrompt={previewPrompt}
            fileCount={fileCount}
            conversationId={selectedConversationId}
            sentMessageFileIds={sentMessageFileIds}
          />
        )}
      </div>

      {/* Landing Disclaimer - fixed at page bottom, sidebar-aware */}
      {showLanding && (
        <div
          className={`fixed bottom-2 inset-x-0 text-center z-30 pointer-events-none transition-[padding] duration-300 ${sidebarCollapsed ? "md:pl-20" : "md:pl-72 lg:pl-80"}`}
        >
          <p className="text-[9px] font-bold text-(--text-secondary) tracking-widest uppercase">
            {t.aiDisclaimer}
          </p>
        </div>
      )}

      {/* Modals */}
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={modals.showUpgradeModal}
          onClose={modals.closeUpgradeModal}
          modelName={modals.restrictedModel || ""}
        />
      </Suspense>

      {/* Deep Research Report Panel */}
      {isDeepResearchMode && isReportPanelOpen && currentTask && currentTask.reportText && (
        <ResearchReportPanel
          title={currentTask.query}
          report={currentTask.reportText}
          sources={currentTask.sources}
          isOpen={isReportPanelOpen}
          onClose={closeReportPanel}
          onOpenThoughts={() => {
            // Only open thoughts if there is thinking data
            if (currentTask.thinkingText) {
              openThinkingPanel();
            }
          }}
          onCreateConversation={
            currentTask.conversationId
              ? () => {
                  closeReportPanel();
                  exitDeepResearch();
                  // Navigate to the conversation
                  if (currentTask.conversationId) {
                    window.location.hash = `#conv=${currentTask.conversationId}`;
                  }
                }
              : undefined
          }
        />
      )}

      {/* Deep Research Thinking Panel */}
      {isDeepResearchMode && isThinkingPanelOpen && currentTask && (
        <ResearchThinkingPanel
          title={currentTask.query}
          isOpen={isThinkingPanelOpen}
          onClose={closeThinkingPanel}
          thinkingText={currentTask.thinkingText}
          sources={currentTask.searchedSources}
          isCompleted={currentTask.status === "completed" || currentTask.status === "failed"}
        />
      )}

      {/* Edit Plan Modal - replaces window.prompt() */}
      {isDeepResearchMode && (
        <EditPlanModal
          isOpen={isEditPlanOpen}
          onClose={() => setIsEditPlanOpen(false)}
          onSubmit={(feedback) => {
            approvePlan(feedback).catch((e) =>
              toast.error(e instanceof Error ? e.message : "Failed to revise plan")
            );
          }}
        />
      )}

      {/* Modals (extracted component) */}
      <ChatModalsSection
        showRenameModal={modals.showRenameModal}
        closeRenameModal={modals.closeRenameModal}
        renameValue={modals.renameValue}
        setRenameValue={modals.setRenameValue}
        confirmRename={modals.confirmRename}
        showDeleteMessageModal={modals.showDeleteMessageModal}
        closeDeleteMessageModal={modals.closeDeleteMessageModal}
        confirmDeleteMessage={modals.confirmDeleteMessage}
        showEditImageModal={showEditImageModal}
        closeEditImageModal={() => setShowEditImageModal(false)}
        editingImagePrompt={editingImagePrompt}
        confirmImageEdit={confirmImageEdit}
        selectedProjectId={selectedProjectId}
        showProjectSettingsModal={showProjectSettingsModal}
        closeProjectSettingsModal={() => setShowProjectSettingsModal(false)}
        onCreateProjectChat={async (projectId) => {
          const conv = await createConversation({ title: "", projectId, model: landingModel });
          if (conv) {
            setSelectedConversationIdAndUrl(conv.id);
            setSelectedProjectId(null);
          }
        }}
        onSelectChat={(chatId) => {
          void handleSelectConversation(chatId);
          setSelectedProjectId(null);
        }}
        t={t}
      />
    </div>
  );
}
