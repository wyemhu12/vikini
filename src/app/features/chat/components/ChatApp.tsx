"use client";

import React, { useEffect, useCallback, useState, lazy, Suspense } from "react";

// UI Components
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import AccessPendingScreen from "@/app/components/AccessPendingScreen";
import DashboardView from "./DashboardView";
import ChatControls from "./ChatControls";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import StreamErrorBanner from "./StreamErrorBanner";
import ScrollToBottomButton from "./ScrollToBottomButton";
import ChatOverlays from "./ChatOverlays";
import ChatLoadingScreen from "./ChatLoadingScreen";
import ChatThemeBackground from "./ChatThemeBackground";
import ChatConversationView from "./ChatConversationView";
import LandingDisclaimer from "./LandingDisclaimer";
import { buildChatControlsProps } from "./chatControlsProps";

const ProjectChatView = lazy(() => import("../../projects/components/ProjectChatView"));

// Hooks
import { useTheme } from "../hooks/useTheme";
import { useConversation } from "../hooks/useConversation";
import { useTTS } from "../hooks/useTTS";
import { useAuthGate } from "./hooks/useAuthGate";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";
import { useImageGenController } from "./hooks/useImageGenController";
import { useChatModals } from "./hooks/useChatModals";
import { useChatTranslations, useLanguage } from "./hooks/useChatTranslations";
import { useUrlSync } from "./hooks/useUrlSync";
import { useChatScroll } from "./hooks/useChatScroll";
import { useLandingModel, useModelSelection } from "./hooks/useModelSelection";
import { useConversationSelectors } from "./hooks/useConversationSelectors";
import { useConversationBranching } from "./hooks/useConversationBranching";
import { useChatAttachments } from "./hooks/useChatAttachments";
import { useThinkingRegenerate } from "./hooks/useThinkingRegenerate";
import { useGemPersonaSync } from "./hooks/useGemPersonaSync";
import { useChatLayoutState } from "./hooks/useChatLayoutState";
import { useProjectNavigation } from "./hooks/useProjectNavigation";
import { useChatShortcuts } from "./hooks/useChatShortcuts";
import { useSidebarActions } from "./hooks/useSidebarActions";
import { useRemixPrompt } from "./hooks/useRemixPrompt";

/**
 * Layout shell coordinator for the chat experience: wires domain hooks
 * together and composes sidebar, header, chat area, controls and overlays.
 */
export default function ChatApp() {
  const { session, isAuthLoading, isAuthed, isPendingAccess } = useAuthGate();

  const { theme } = useTheme();
  const { t: tRaw } = useLanguage();
  const t = useChatTranslations();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Image Mode State (activated from DashboardView)
  const [pendingImageMode, setPendingImageMode] = useState(false);
  const activateImageMode = useCallback(() => setPendingImageMode(true), []);

  // Prompt Preview State (hover suggestion → preview in input)
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { landingModel, saveLandingModel } = useLandingModel();

  const conversation = useConversation();
  const { conversations, selectedConversationId, createConversation, refreshConversations } =
    conversation;

  const { setSelectedConversationIdAndUrl, isRemixMode } = useUrlSync({
    selectedConversationId,
    setSelectedConversationId: conversation.setSelectedConversationId,
  });

  const { contextMessagesCount, filteredConversations, currentConversation, parentConversation } =
    useConversationSelectors({
      conversations,
      personalConversations: conversation.personalConversations,
      rawMessages: conversation.messages,
      selectedConversationId,
    });
  const currentModel = currentConversation?.model || landingModel;

  const webSearch = useWebSearchPreference();

  const chat = useChatStreamController({
    isAuthed,
    selectedConversationId,
    setSelectedConversationId: setSelectedConversationIdAndUrl,
    createConversation: useCallback(
      () => createConversation({ model: landingModel }),
      [createConversation, landingModel]
    ),
    refreshConversations,
    renameConversationOptimistic: conversation.renameConversationOptimistic,
    onWebSearchMeta: webSearch.applyServerMeta,
  });
  const { renderedMessages, setInput, isStreaming, streamingAssistant } = chat;
  const { handleNewChat, handleSelectConversation } = chat;

  const branching = useConversationBranching({
    selectedConversationId,
    refreshConversations,
    onBranchCreated: setSelectedConversationIdAndUrl,
    t: tRaw,
  });

  const attachments = useChatAttachments({
    selectedConversationId,
    renderedMessages,
    landingModel,
    createConversation,
    setSelectedConversationIdAndUrl,
  });

  const thinking = useThinkingRegenerate({
    currentModel,
    isStreaming,
    handleRegenerate: chat.handleRegenerate,
    t: tRaw,
  });

  const modals = useChatModals({
    conversations: conversations || [],
    selectedConversationId,
    deleteConversation: conversation.deleteConversation,
    renameConversation: conversation.renameConversation,
    renameConversationOptimistic: conversation.renameConversationOptimistic,
    refreshConversations,
    resetChatUI: chat.resetChatUI,
    setMessages: chat.setMessages,
  });

  const { isModelAllowed, handleModelChange } = useModelSelection({
    isAuthed,
    selectedConversationId,
    saveLandingModel,
    patchConversationModel: conversation.patchConversationModel,
    setConversationModel: conversation.setConversationModel,
    openUpgradeModal: modals.openUpgradeModal,
    errorMessage: t.error,
  });

  const tts = useTTS(); // Reads AI responses aloud

  const imageGen = useImageGenController({
    selectedConversationId,
    createConversation,
    setSelectedConversationIdAndUrl,
    currentModel,
    t: tRaw,
    onSuccess: () => {
      // Reload messages to show the generated image, then clear temporary state
      if (selectedConversationId) void handleSelectConversation(selectedConversationId);
      imageGen.setLastGeneratedImage(null);
    },
  });

  useRemixPrompt(setInput);

  const scroll = useChatScroll({
    isStreaming,
    streamingAssistant,
    renderedMessagesLength: renderedMessages.length,
    lastGeneratedImage: imageGen.lastGeneratedImage,
    conversationId: selectedConversationId,
  });

  useGemPersonaSync(conversation);

  const navigateHome = useCallback(() => {
    void handleSelectConversation(null);
    setSelectedProjectId(null);
  }, [handleSelectConversation]);
  const layout = useChatLayoutState({ onNavigateHome: navigateHome });
  const { closeMobileSidebar, sidebarCollapsed, showMobileControls } = layout;

  const projectNav = useProjectNavigation({
    selectedProjectId,
    conversations,
    setSelectedProjectId,
    landingModel,
    createConversation,
    setSelectedConversationIdAndUrl,
    handleSelectConversation,
    closeMobileSidebar,
  });

  const sidebarActions = useSidebarActions({
    handleSelectConversation,
    handleNewChat,
    openRenameModal: modals.openRenameModal,
    closeMobileSidebar,
  });

  const shortcuts = useChatShortcuts({ onNewChat: handleNewChat });

  // Auth gates
  if (isAuthLoading || !isAuthed) return <ChatLoadingScreen label={t.loading} />;

  if (isPendingAccess) return <AccessPendingScreen />;

  // Main app view state
  const showProjectView = selectedProjectId && !selectedConversationId;
  const { selectedProject } = projectNav;
  const showLanding =
    !isRemixMode && !showProjectView && (!selectedConversationId || renderedMessages.length === 0);

  const controlsProps = buildChatControlsProps({
    chat,
    webSearch,
    thinking,
    imageGen,
    attachments,
    handleSend: chat.handleSend,
    currentModel,
    handleModelChange,
    isModelAllowed,
    currentConversation,
    selectedConversationId,
    showMobileControls,
    initialImageMode: pendingImageMode || isRemixMode,
    onImageModeConsumed: () => setPendingImageMode(false),
    previewPrompt,
  });

  return (
    <div className="h-dvh w-full text-primary overflow-hidden relative font-sans bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--accent-foreground) focus:text-xs focus:font-semibold"
      >
        {tRaw("skipToMainContent")}
      </a>
      <ToastContainer />
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      <StreamErrorBanner error={chat.streamError} onDismiss={chat.clearStreamError} />

      <Sidebar
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={sidebarActions.onSelectConversation}
        onNewChat={sidebarActions.onNewChat}
        onDeleteConversation={modals.openDeleteModal}
        onRenameChat={sidebarActions.onRenameChat}
        onLogout={sidebarActions.onLogout}
        mobileOpen={layout.mobileOpen}
        onCloseMobile={closeMobileSidebar}
        session={session}
        collapsed={sidebarCollapsed}
        onToggleCollapse={layout.memoizedOnToggleCollapse}
        onLogoClick={layout.memoizedOnLogoClick}
        allConversations={conversations}
        onCreateProjectChat={projectNav.memoizedOnCreateProjectChat}
        onSelectProject={projectNav.memoizedOnSelectProject}
        onRenameProjectConversation={sidebarActions.onRenameChat}
        onDeleteProjectConversation={modals.openDeleteModal}
        isCreatingChat={conversation.creatingConversation}
      />

      {!layout.mobileOpen && <FloatingMenuTrigger onClick={layout.toggleMobileSidebar} />}

      <div
        className={`@container/chat h-full flex flex-col relative z-10 transition-[padding] duration-300 ${sidebarCollapsed ? "md:pl-[calc(5rem+var(--sal,0px))]" : "md:pl-[calc(18rem+var(--sal,0px))] lg:pl-[calc(20rem+var(--sal,0px))]"} pr-[var(--sar,0px)]`}
      >
        <HeaderBar
          onToggleSidebar={layout.toggleMobileSidebar}
          showMobileControls={showMobileControls}
        />

        <div
          id="main-content"
          tabIndex={-1}
          ref={scroll.scrollRef}
          onScroll={scroll.handleScroll}
          onTouchStart={scroll.handleTouchStart}
          onTouchEnd={scroll.handleTouchEnd}
          onClick={() => layout.handleContentTap(showLanding)}
          className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative pt-[calc(6rem+var(--sat,0px))] md:pt-0 pb-[calc(8rem+var(--sab,0px))] md:pb-0 cursor-pointer md:cursor-auto"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {mounted && theme && (
            <ChatThemeBackground theme={theme} sidebarCollapsed={sidebarCollapsed} />
          )}

          {showProjectView && selectedProject ? (
            <Suspense fallback={null}>
              <ProjectChatView
                project={selectedProject}
                conversations={projectNav.projectConversations}
                onNewChat={() => void projectNav.createProjectChat(selectedProject.id)}
                onSelectConversation={projectNav.openProjectChat}
                onOpenSettings={projectNav.openProjectSettings}
                onRenameConversation={sidebarActions.onRenameChat}
                onDeleteConversation={modals.openDeleteModal}
              />
            </Suspense>
          ) : showLanding ? (
            <div className="min-h-full flex flex-col items-center justify-center pb-[25vh] animate-in fade-in zoom-in duration-500">
              <DashboardView
                onPromptSelect={setInput}
                onPromptPreview={setPreviewPrompt}
                onActivateImageMode={activateImageMode}
              >
                {/* ChatControls rendered between greeting and chips */}
                <ChatControls {...controlsProps} isLanding={true} />
              </DashboardView>
            </div>
          ) : (
            <ChatConversationView
              chat={chat}
              imageGen={imageGen}
              thinking={thinking}
              branching={branching}
              currentConversation={currentConversation}
              parentConversation={parentConversation}
              contextMessagesCount={contextMessagesCount}
              selectedConversationId={selectedConversationId}
              currentModel={currentModel}
              openDeleteMessageModal={modals.openDeleteMessageModal}
              setSelectedConversationIdAndUrl={setSelectedConversationIdAndUrl}
              tts={tts}
              tRaw={tRaw}
              t={t}
              scrollContainerRef={scroll.scrollRef}
            />
          )}
        </div>

        {!showProjectView && !showLanding && (
          <>
            <div className="absolute right-[calc(1.5rem+var(--sar,0px))] bottom-[calc(8rem+var(--sab,0px))] z-20 pointer-events-auto">
              <ScrollToBottomButton
                isAtBottom={scroll.isAtBottom}
                unreadCount={scroll.unreadCount}
                onClick={() => scroll.scrollToBottom(true)}
              />
            </div>
            <ChatControls {...controlsProps} />
          </>
        )}
      </div>

      {showLanding && (
        <LandingDisclaimer text={t.aiDisclaimer} sidebarCollapsed={sidebarCollapsed} />
      )}

      <ChatOverlays
        modals={modals}
        imageGen={imageGen}
        projectNav={projectNav}
        shortcuts={shortcuts}
        conversations={filteredConversations}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        t={t}
      />
    </div>
  );
}
