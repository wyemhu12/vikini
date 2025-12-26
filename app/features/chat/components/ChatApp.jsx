// /app/features/chat/components/ChatApp.jsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import InputForm from "./InputForm";
import AttachmentsPanel from "./AttachmentsPanel";

import { useTheme } from "../hooks/useTheme";
import { useLanguage } from "../hooks/useLanguage";
import { useConversation } from "../hooks/useConversation";

import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";

import {
  DEFAULT_MODEL,
  SELECTABLE_MODELS,
  isSelectableModelId,
} from "@/lib/core/modelRegistry";

// Shared model registry (single source of truth)
const AVAILABLE_MODELS = SELECTABLE_MODELS;

export default function ChatApp() {
  const { data: session, status } = useSession();

  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  // ✅ Mobile sidebar drawer state
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

  // ✅ Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;

    const body = document.body;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflowY: body.style.overflowY,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflowY = "scroll";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflowY = prev.overflowY;

      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  // ✅ Build `t` đầy đủ key
  const t = useMemo(() => {
    const keys = [
      "appName", "whitelist", "whitelistOnly", "landingMessage", "exploreGems", "signOut", "newChat", 
      "send", "placeholder", "refresh", "deleteAll", "logout", "modelSelector",
      "selectModel", "currentModel", "appliedGem", "appliedGemNone", "webSearch",
      "webSearchOn", "webSearchOff", "aiDisclaimer", "loading", "noConversations",
      "uploadFile", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview",
      "gemini-3-pro-preview", "gemini-3-flash", "gemini-3-pro", "modelDescFlash25",
      "modelDescPro25", "modelDescFlash3", "modelDescPro3", "blueprint", "amber",
      "indigo", "charcoal", "gold", "red", "rose", "gemsTitle", "myGems", "premadeGems",
      "createGem", "editGem", "deleteGem", "saveGem", "cancel", "select", "error", "success", "renameChat", "deleteConfirm"
    ];

    const result = {};
    keys.forEach(k => {
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
    renameConversationFinal,
    renameConversation,
    deleteConversation,
    // Model management
    setConversationModel,
    patchConversationModel,
  } = useConversation();

  // ✅ Keep Web Search toggle UI (theo yêu cầu)
  const {
    webSearchEnabled,
    toggleWebSearch,
    setServerWebSearch,
    setServerWebSearchAvailable,
    serverHint,
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
  } = useChatStreamController({
    isAuthed,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    refreshConversations,
    renameConversationOptimistic,
    renameConversationFinal,

    onWebSearchMeta: ({ enabled, available }) => {
      if (typeof enabled === "boolean") setServerWebSearch(enabled);
      if (typeof available === "boolean") setServerWebSearchAvailable(available);
    },
  });

  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages, streamingAssistant]);

  // ✅ Wire rename/delete
  const handleRenameFromSidebar = useCallback(
    async (id) => {
      try {
        const current = (Array.isArray(conversations) ? conversations : []).find(
          (c) => c?.id === id
        );
        const curTitle = current?.title || "";
        const nextTitle = window.prompt(t.renameChat || "Đổi tên cuộc hội thoại:", curTitle);
        if (nextTitle === null) return;
        const title = String(nextTitle).trim();
        if (!title) return;

        renameConversationOptimistic(id, title);
        await renameConversation(id, title);
      } catch (e) {
        console.error(e);
      }
    },
    [conversations, renameConversation, renameConversationOptimistic, t]
  );

  const handleDeleteFromSidebar = useCallback(
    async (id) => {
      try {
        const ok = window.confirm(t.deleteConfirm || "Xoá cuộc hội thoại này?");
        if (!ok) return;

        await deleteConversation(id);

        if (selectedConversationId === id) {
          resetChatUI();
        }

        await refreshConversations();
      } catch (e) {
        console.error(e);
      }
    },
    [deleteConversation, refreshConversations, resetChatUI, selectedConversationId, t]
  );

  // ✅ Get current conversation info
  const currentConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return (Array.isArray(conversations) ? conversations : []).find(
      (c) => c?.id === selectedConversationId
    );
  }, [conversations, selectedConversationId]);

  const currentModelRaw = currentConversation?.model || DEFAULT_MODEL;
  const currentModel = isSelectableModelId(currentModelRaw) ? currentModelRaw : DEFAULT_MODEL;
  const currentGem = currentConversation?.gem || null;

  // ✅ Auto-migrate old/unsupported model values
  useEffect(() => {
    if (!selectedConversationId) return;
    const raw = currentConversation?.model;

    if (!raw) return;
    if (isSelectableModelId(raw)) return;

    (async () => {
      try {
        patchConversationModel?.(selectedConversationId, DEFAULT_MODEL);
        await setConversationModel?.(selectedConversationId, DEFAULT_MODEL);
      } catch (e) {
        console.error("Failed to migrate unsupported model:", e);
      }
    })();
  }, [selectedConversationId, currentConversation?.model, patchConversationModel, setConversationModel]);

  // ✅ Handle model change
  const handleModelChange = useCallback(
    async (newModel) => {
      if (!selectedConversationId) return;

      const next = String(newModel || "").trim();
      if (!isSelectableModelId(next)) return;
      if (next === currentModel) return;

      try {
        patchConversationModel?.(selectedConversationId, next);
        await setConversationModel?.(selectedConversationId, next);
      } catch (e) {
        console.error("Failed to change model:", e);
        patchConversationModel?.(selectedConversationId, currentModel);
      }
    },
    [selectedConversationId, currentModel, setConversationModel, patchConversationModel]
  );

  // ✅ Redirect to custom signin
  useEffect(() => {
    if (!isAuthLoading && !isAuthed) {
      signIn();
    }
  }, [isAuthed, isAuthLoading]);

  if (isAuthLoading || !isAuthed) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-200 chat-gradient">
        <div className="animate-pulse flex flex-col items-center gap-4">
           <div className="text-4xl font-black text-[var(--primary)]">{t.appName}</div>
           <div className="text-xs tracking-widest text-neutral-500 uppercase">{t.loading}</div>
        </div>
      </div>
    );
  }

  const showLanding = !selectedConversationId || renderedMessages.length === 0;

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100">
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
      />

      <div className="h-full flex flex-col md:pl-80">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onThemeChange={toggleTheme}
          onToggleSidebar={toggleMobileSidebar}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 md:px-6 py-6 relative">
          {showLanding ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
              <div className="max-w-md space-y-6">
                 <div className="mx-auto h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--primary)] shadow-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h9m-9 3h9m-6.75-12.75H16.5a2.25 2.25 0 0 1 2.25 2.25v13.5a2.25 2.25 0 0 1-2.25 2.25H7.5a2.25 2.25 0 0 1-2.25-2.25V5.25A2.25 2.25 0 0 1 7.5 3Z" />
                    </svg>
                 </div>
                 <h2 className="text-xl md:text-2xl font-medium text-white tracking-tight leading-relaxed">
                   {t.landingMessage || "Ask anything to start a new conversation."}
                 </h2>
                 <p className="text-sm text-neutral-500 font-medium tracking-wide">
                   {t.appName} AI • NEXT GEN INTELLIGENCE
                 </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full space-y-4">
              {renderedMessages.map((m, idx) => (
                <ChatBubble
                  key={m.id ?? idx}
                  message={m}
                  isLastAssistant={false}
                  canRegenerate={false}
                  regenerating={false}
                />
              ))}

              {streamingAssistant !== null && (
                <ChatBubble
                  message={{
                    role: "assistant",
                    content: streamingAssistant,
                    sources: streamingSources,
                    urlContext: streamingUrlContext,
                  }}
                  isLastAssistant
                  canRegenerate
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                />
              )}
            </div>
          )}
        </div>

        <div className="max-w-3xl mx-auto w-full">
          <div className="px-4 pt-2 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-500 hidden sm:inline">
                {t.modelSelector}:
              </span>
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isStreaming || regenerating}
                className="text-sm px-3 py-2 rounded-full ring-1 ring-neutral-700 bg-neutral-900 text-neutral-100 outline-none focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                title={t.selectModel}
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t[m.id] || m.id}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={toggleWebSearch}
              className={[
                "text-sm px-3.5 py-2 rounded-full ring-1 transition",
                webSearchEnabled
                  ? "bg-neutral-900 ring-neutral-700 text-neutral-100"
                  : "bg-neutral-950 ring-neutral-800 text-neutral-400 hover:text-neutral-200",
              ].join(" ")}
              title={t.webSearch}
              type="button"
            >
              {t.webSearch}: {webSearchEnabled ? t.webSearchOn : t.webSearchOff}
              {webSearchEnabled ? serverHint : ""}
            </button>

            <div
              className="text-sm px-3.5 py-2 rounded-full ring-1 ring-neutral-800 bg-neutral-950 text-neutral-400"
              title={t.appliedGem}
            >
              {t.appliedGem}: {currentGem?.name || t.appliedGemNone}
              {currentGem?.icon ? ` ${currentGem.icon}` : ""}
            </div>
          </div>

          <AttachmentsPanel
            conversationId={selectedConversationId}
            disabled={creatingConversation || isStreaming || regenerating}
            onAfterAnalyze={async () => {
              if (selectedConversationId) {
                await handleSelectConversation(selectedConversationId);
              }
            }}
          />

          <InputForm
            input={input}
            onChangeInput={setInput}
            onSubmit={() => handleSend()}
            disabled={creatingConversation || isStreaming || regenerating}
            t={t}
            conversationId={selectedConversationId}
          />
        </div>
      </div>
    </div>
  );
}
