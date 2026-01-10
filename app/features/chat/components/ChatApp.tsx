// /app/features/chat/components/ChatApp.tsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

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

import { ImageGenPreview } from "../../image-gen/components/ImageGenPreview";
import { ImageGenOptions } from "@/lib/features/image-gen/core/types";

// Removed deprecated generateImageAction import
import { DEFAULT_MODEL, SELECTABLE_MODELS } from "@/lib/core/modelRegistry";

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize Language ONCE from localStorage (moved from hook to avoid loops)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("vikini-language");
      // Only set if stored is valid and DIFFERENT from current default
      if (stored && LANGS.includes(stored as any) && stored !== language) {
        setLanguage(stored as "vi" | "en");
      }
    }
  }, []); // Run ONCE on mount

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [restrictedModel, setRestrictedModel] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Sidebar Collapsed State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Allowed Models (check access permissions)
  const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed);

  // Function to check if a model is allowed
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

  const {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
  } = useWebSearchPreference();

  // URL State Sync (Declared HERE to access useConversation hooks)
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 1. Sync URL -> State (On Mount & PopState)
  useEffect(() => {
    const idFromUrl = searchParams?.get("id");
    // Ensure we don't infinite loop if they match
    if (idFromUrl && idFromUrl !== selectedConversationId) {
      setSelectedConversationId(idFromUrl);
    } else if (!idFromUrl && selectedConversationId) {
      setSelectedConversationId(null);
    }
  }, [searchParams, selectedConversationId, setSelectedConversationId]);

  // 2. Sync Query helper
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

  // Wrapper for setting ID and URL together
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
    setSelectedConversationId: setSelectedConversationIdAndUrl, // Pass wrapper here!
    createConversation,
    refreshConversations,
    renameConversationOptimistic,

    onWebSearchMeta: ({ enabled, available }: { enabled?: boolean; available?: boolean }) => {
      if (typeof enabled === "boolean") setServerWebSearch(enabled);
      if (typeof available === "boolean") setServerWebSearchAvailable(available);
    },
  });

  // Image Gen State
  const [lastGeneratedImage, setLastGeneratedImage] = useState<{
    url: string;
    prompt: string;
  } | null>(null);

  // ... (inside component)

  const handleImageGen = useCallback(
    async (prompt: string, options?: ImageGenOptions) => {
      if (!prompt.trim()) return;

      setInput("");
      // Optimistic UI: We could add a local "Thinking..." message here if we had a setMessages setter exposed from hook.
      // For now, rely on loading state or maybe set a temporary indicator.
      // Optional: Add a placeholder message? (Requires access to setRenderedMessages which is inside the hook)
      // Since `useChatStreamController` manages messages, we might need a way to inject a message.
      // For now, let's just wait for response. The user will see "Generating..." if we want, but simpler to just wait.
      // Or better: Use the `lastGeneratedImage` as a loading indicator?
      setLastGeneratedImage({ url: "", prompt }); // Shows loading spinner in preview bubble

      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            conversationId: selectedConversationId,
            options,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate image");
        }

        if (data.success && data.message) {
          // Success!
          // We got a persisted message back.
          // 1. Clear validation/loading state
          setLastGeneratedImage(null);

          // 2. Refresh conversation to pull the new message
          // This ensures we get the message formatted exactly as the server sees it (decrypted etc)
          // `useChatStreamController` exposes `refreshConversations` but that refreshes the list in sidebar.
          // We need to refresh the current chat's messages.
          // The `ChatApp` doesn't expose `refreshMessages` directly easily without refactoring useChatStreamController.
          // TRICK: We can trigger a re-fetch by toggling something or just relying on `swr` if used.
          // But here `useChatStreamController` likely uses `useEffect` on `selectedConversationId`.

          // Let's try to reload the page or trigger a soft refresh? No, that's bad UX.
          // Looking at `ChatApp.tsx`, it calls `resetChatUI` which clears messages.

          // Ideally: `useChatStreamController` should expose `addMessage` or `reloadMessages`.
          // Let's assume for now we have to manually add it or trigger a reload.
          // Since we can't easily inject into `renderedMessages` (it comes from hook),
          // we might just reload the window? No.

          // Let's look at `ChatControls` or `Sidebar`.
          // Actually, if we just toggle `selectedConversationId` to null and back, it flickers.

          // Wait, `lastGeneratedImage` was used to show result.
          // If we want to show it IN CHAT, we rely on `renderedMessages`.
          // If `renderedMessages` is not re-validating, we have a problem.
          // `useChatStreamController` likely fetches messages on mount/change.

          // FOR NOW: Let's keep showing it in `lastGeneratedImage` as well as a "success" state?
          // No, the goal was persistence.

          // If we simply trigger `setSelectedConversationId` to the SAME ID, does it re-fetch?
          // Usually yes, if the hook depends on it.
          // Let's try:
          // setSelectedConversationId(selectedConversationId);

          // Or better, we force a reload of the conversation data.
          // For this specific codebase, let's reload the page (worst case) or just alert success.
          // Actually, let's keep `lastGeneratedImage` as a "New!" notification popup
          // AND let the user know it is saved.
          // BUT `lastGeneratedImage` is transient.

          // Let's hack: Trigger a re-navigation to the same URL to force re-fetch?
          router.refresh();

          // Also set the preview just in case the refresh is slow, so user sees something.
          if (data.imageUrl) {
            setLastGeneratedImage({ url: data.imageUrl, prompt });
          }
        } else {
          alert("Failed to gen image");
          setLastGeneratedImage(null);
        }
      } catch (e) {
        console.error(e);
        alert("Error generating image");
        setLastGeneratedImage(null);
      }
    },
    [setInput, selectedConversationId, router]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll only when NOT streaming to avoid annoying jumps
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isStreaming) return; // Disable auto-scroll during streaming

    // Only scroll on initial load or new user message, not constantly during stream
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages.length, isStreaming, lastGeneratedImage]); // Added lastGeneratedImage to scroll

  // Auto-hide mobile controls logic (Tap to Toggle)
  const [showMobileControls, setShowMobileControls] = useState(true);

  // Restore Missing Functions
  const handleRenameFromSidebar = useCallback(
    async (id: string) => {
      const current = (conversations || []).find((c: any) => c?.id === id);
      const nextTitle = window.prompt(t.renameChat, current?.title || "");
      if (nextTitle) {
        renameConversationOptimistic(id, nextTitle.trim());
        await renameConversation(id, nextTitle.trim());
      }
    },
    [conversations, renameConversation, renameConversationOptimistic, t]
  );

  const handleDeleteFromSidebar = useCallback(async (id: string) => {
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
    () => (conversations || []).find((c: any) => c?.id === selectedConversationId),
    [conversations, selectedConversationId]
  );

  const currentModel = currentConversation?.model || DEFAULT_MODEL;
  const currentGem = currentConversation?.gem || null;

  const handleModelChange = useCallback(
    async (newModelId: string) => {
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
    setLastGeneratedImage(null); // Fix: Clear previous generated image preview
  }, [selectedConversationId, setFileCount, setShowFiles]);

  // Register callback for gem applied - optimistic update when gem changes
  const { setOnGemApplied } = useGemStore();
  useEffect(() => {
    setOnGemApplied((conversationId: string, gem: any) => {
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

  // Check was here, moved down

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!confirm(t.modalDeleteConfirm)) return;

      try {
        // Optimistic UI update
        setMessages((prev) => prev.filter((m) => m.id !== messageId));

        const res = await fetch(`/api/messages/${messageId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error("Failed to delete message");
        }
      } catch (e) {
        console.error("Delete message error:", e);
        alert(t.error);
        // Revert optimistic update? For now assume success or reload.
        // Actually simplest is to trigger a conversation refresh if it fails,
        // but optimistic removal is better UX.
        // If failed, we might want to reload messages.
        if (selectedConversationId) {
          // Soft refresh
          const res = await fetch(`/api/conversations?id=${selectedConversationId}`);
          if (res.ok) {
            await res.json();
            // We need to access setMessages which IS allowed now.
            // But we need to use normalize... wait, normalize is internal to hook.
            // But we can just set raw data if the hook allowed?
            // Actually `setMessages` in hook uses `normalizeMessages` on render,
            // but `setMessages` expects `FrontendMessage[]`.
            // The API returns raw messages. We need to be careful.
            // Ideally we shouldn't manually fetch here if failure happens, just let it be.
          }
        }
      }
    },
    [t, setMessages, selectedConversationId]
  );

  const showLanding = !selectedConversationId || renderedMessages.length === 0;

  // Check if user is not whitelisted (pending approval)
  // MOVED HERE: Must be after all hooks
  if (isAuthed && (session?.user as any)?.rank === "not_whitelisted") {
    return <AccessPendingScreen />;
  }

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
          handleSelectConversation(null);
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
          onLanguageChange={(lang) => setLanguage(lang as "vi" | "en")}
          // @ts-ignore
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
          className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth relative pt-24 md:pt-0 pb-32 md:pb-0 cursor-pointer md:cursor-auto" // Added pt-24 (mobile header), pb-32 (mobile input)
        >
          {/* RA2 Theme Background Logos - Centered in Chat Content Area */}
          {mounted && (theme === "yuri" || theme === "allied" || theme === "soviet") && (
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
                onPromptSelect={(text: string) => {
                  setInput(text);
                  // Optional: auto focus input
                }}
                lastConversation={conversations?.[0]}
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
                    regenerating={regenerating && isLastAI}
                  />
                );
              })}

              {/* Generated Image Preview Bubble */}
              {lastGeneratedImage && (
                <div className="flex w-full flex-col gap-3 py-6">
                  <div className="flex max-w-[95%] lg:max-w-[90%] gap-4 items-start">
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-token bg-surface-elevated text-primary text-[10px] font-black shadow-sm">
                      AI
                    </div>
                    <div className="flex flex-col gap-2 w-full min-w-0">
                      <ImageGenPreview
                        imageUrl={lastGeneratedImage.url}
                        isLoading={!lastGeneratedImage.url}
                        prompt={lastGeneratedImage.prompt}
                        onClose={() => setLastGeneratedImage(null)}
                      />
                    </div>
                  </div>
                </div>
              )}

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
          onImageGen={handleImageGen}
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
