"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// UI Components
import ChatBubble from "./ChatBubble";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import AccessPendingScreen from "@/app/components/AccessPendingScreen";
import DashboardView from "./DashboardView";
import ChatControls from "./ChatControls";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";

import React, { useEffect, useRef, useMemo, useCallback, useState, lazy, Suspense } from "react";

import { useTheme } from "../hooks/useTheme";
import { useLanguage, LANGS } from "../hooks/useLanguage";
import { useConversation } from "../hooks/useConversation";
import { useGemStore } from "../../gems/stores/useGemStore";
import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";
import { useAllowedModels } from "./hooks/useAllowedModels";
import { useFileDragDrop } from "./hooks/useFileDragDrop";
import { useImageGenController } from "./hooks/useImageGenController";
import { toast } from "@/lib/store/toastStore";

// Utils & Constants
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import { MODEL_IDS } from "@/lib/utils/constants";

// Lazy-loaded modals for code splitting
const UpgradeModal = lazy(() => import("@/app/components/UpgradeModal"));
const DeleteConfirmModal = lazy(() => import("@/app/components/DeleteConfirmModal"));
const EditImagePromptModal = lazy(() => import("@/app/components/EditImagePromptModal"));

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme } = useTheme();

  const { language, setLanguage, t: tRaw } = useLanguage();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize Language ONCE from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vikini-language");
      if (stored && LANGS.includes(stored as any) && stored !== language) {
        setLanguage(stored as "vi" | "en");
      }
    }
  }, [language, setLanguage]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

  // Modal States
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restrictedModel, setRestrictedModel] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const attachmentsRef = useRef<any>(null);
  const { showFiles, setShowFiles, fileCount, setFileCount } = useFileDragDrop(attachmentsRef);

  const t: Record<string, any> = useMemo(() => {
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
      "modalUpgradeTitle",
      "modalUpgradeRequestedModel",
      "modalUpgradeNoPermission",
      "modalUpgradeContactAdmin",
      "modalUpgradeGotIt",
      "modalDeleteTitle",
      "modalDeleteWarning",
      "modalDeleteConfirm",
      "modalDeleteButton",
      "descSuggestionCode",
      "descSuggestionImage",
      "descSuggestionAnalyze",
      "descSuggestionChat",
      "descStatsTokenUsage",
      "descStatsNoData",
    ];
    const result: Record<string, any> = {};
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

  // Filter out Image Studio projects from chat list
  const filteredConversations = useMemo(() => {
    return (conversations || []).filter((c: any) => c.model !== MODEL_IDS.IMAGE_STUDIO);
  }, [conversations]);

  const {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
  } = useWebSearchPreference();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Sync URL -> State
  useEffect(() => {
    const idFromUrl = searchParams?.get("id");
    if (idFromUrl && idFromUrl !== selectedConversationId) {
      setSelectedConversationId(idFromUrl);
    } else if (!idFromUrl && selectedConversationId) {
      setSelectedConversationId(null);
    }
  }, [searchParams, selectedConversationId, setSelectedConversationId]);

  const syncUrlWithId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (id) {
        params.set("id", id);
      } else {
        params.delete("id");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router]
  );

  const setSelectedConversationIdAndUrl = useCallback(
    (id: string | null) => {
      setSelectedConversationId(id);
      syncUrlWithId(id);
    },
    [setSelectedConversationId, syncUrlWithId]
  );

  const {
    renderedMessages,
    input,
    setInput,
    creatingConversation,
    isStreaming,
    streamingAssistant,
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

  const currentConversation = useMemo(
    () => (conversations || []).find((c: any) => c?.id === selectedConversationId),
    [conversations, selectedConversationId]
  );
  const currentModel = currentConversation?.model || DEFAULT_MODEL;

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

  // remix prompt logic
  useEffect(() => {
    if (typeof window !== "undefined") {
      const remixPrompt = sessionStorage.getItem("remixPrompt");
      if (remixPrompt) {
        setInput(remixPrompt);
        sessionStorage.removeItem("remixPrompt");
      }
    }
  }, [setInput]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current || isStreaming) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages.length, isStreaming, lastGeneratedImage]);

  const [showMobileControls, setShowMobileControls] = useState(true);

  const handleRenameFromSidebar = useCallback(
    async (id: string) => {
      const current = (conversations || []).find((c: any) => c?.id === id);
      const nextTitle = window.prompt(t.renameChat, current?.title || "");
      if (nextTitle) {
        renameConversationOptimistic(id, nextTitle.trim());
        await renameConversation(id, nextTitle.trim());
      }
    },
    [conversations, renameConversation, renameConversationOptimistic, t.renameChat]
  );

  const handleDeleteFromSidebar = useCallback(async (id: string) => {
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
      toast.error(t.error);
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
    t.error,
  ]);

  const handleModelChange = useCallback(
    async (newModelId: string) => {
      if (!isModelAllowed(newModelId)) {
        const model = SELECTABLE_MODELS.find((m) => m.id === newModelId);
        setRestrictedModel(model?.name || newModelId);
        setShowUpgradeModal(true);
        return;
      }
      if (!selectedConversationId) return;
      try {
        patchConversationModel?.(selectedConversationId, newModelId);
        await setConversationModel?.(selectedConversationId, newModelId);
      } catch (e) {
        console.error(e);
        toast.error(t.error);
      }
    },
    [isModelAllowed, selectedConversationId, patchConversationModel, setConversationModel, t.error]
  );

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
    setOnGemApplied((conversationId: string, gem: any) => {
      patchConversationGem(conversationId, gem);
      refreshConversations();
    });
    return () => {
      if (useGemStore.getState().setOnGemApplied) {
        useGemStore.getState().setOnGemApplied(null);
      }
    };
  }, [setOnGemApplied, patchConversationGem, refreshConversations]);

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!confirm(t.modalDeleteConfirm)) return;
      try {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        const res = await fetch(`/api/messages/${messageId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete message");
      } catch (e) {
        console.error("Delete message error:", e);
        toast.error(t.error);
      }
    },
    [t.modalDeleteConfirm, t.error, setMessages]
  );

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

  const isRemixMode = searchParams?.get("mode") === "remix";
  const showLanding = !isRemixMode && (!selectedConversationId || renderedMessages.length === 0);

  if (isAuthed && (session?.user as any)?.rank === "not_whitelisted") {
    return <AccessPendingScreen />;
  }

  return (
    <div className="h-screen w-screen text-primary overflow-hidden relative font-sans bg-surface">
      <ToastContainer />
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      {/* Stream Error Notification (Generalised Error Display) */}
      {streamError && (
        <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-red-900/90 backdrop-blur-xl border border-red-500/50 rounded-xl p-4 shadow-2xl flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-red-400 text-lg">⚠</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-red-200 mb-1">
                {streamError.isTokenLimit ? t.tokenLimitTitle : t.error}
              </h4>
              <p className="text-xs text-red-300/80 break-words">
                {streamError.isTokenLimit && streamError.tokenInfo
                  ? t.tokenLimitError
                      .replace("{{limit}}", streamError.tokenInfo.limit?.toLocaleString() || "?")
                      .replace(
                        "{{requested}}",
                        streamError.tokenInfo.requested?.toLocaleString() || "?"
                      )
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
      )}

      <Sidebar
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={useCallback(
          (id: string | null) => {
            handleSelectConversation(id);
            closeMobileSidebar();
          },
          [handleSelectConversation, closeMobileSidebar]
        )}
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
          onLanguageChange={useCallback(
            (lang: any) => setLanguage(lang as "vi" | "en"),
            [setLanguage]
          )}
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
          {mounted && (theme === "yuri" || theme === "allied" || theme === "soviet") && (
            <div
              className={`fixed top-0 left-0 right-0 bottom-0 z-[0] pointer-events-none transition-all duration-300 ${sidebarCollapsed ? "md:left-20" : "md:left-72 lg:left-80"}`}
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

          {showLanding ? (
            <div className="min-h-full flex flex-col justify-center py-4 animate-in fade-in zoom-in duration-500">
              <DashboardView
                onPromptSelect={setInput}
                lastConversation={filteredConversations?.[0]}
                onSelectConversation={handleSelectConversation}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-8 space-y-2">
              {renderedMessages.map((m: any, idx: number) => {
                const isLastAI = m.role === "assistant" && idx === renderedMessages.length - 1;
                return (
                  <ChatBubble
                    key={m.id ?? idx}
                    message={m}
                    isLastAssistant={isLastAI}
                    canRegenerate={m.role === "assistant"}
                    onRegenerate={() => handleRegenerate(m)}
                    onEdit={handleEdit}
                    onDelete={handleDeleteMessage}
                    onImageRegenerate={handleImageRegenerate}
                    onImageEdit={handleImageEdit}
                    regenerating={regenerating && isLastAI}
                  />
                );
              })}

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
        />
      </div>

      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={useCallback(() => setShowUpgradeModal(false), [])}
          modelName={restrictedModel || ""}
          t={t}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onCancel={useCallback(() => setShowDeleteModal(false), [])}
          onConfirm={confirmDelete}
          t={t}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EditImagePromptModal
          isOpen={showEditImageModal}
          onClose={useCallback(() => setShowEditImageModal(false), [])}
          initialPrompt={editingImagePrompt}
          onConfirm={confirmImageEdit}
          t={t}
        />
      </Suspense>
    </div>
  );
}
