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

const AVAILABLE_MODELS = SELECTABLE_MODELS;

export default function ChatApp() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);

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
      "createGem", "editGem", "deleteGem", "saveGem", "cancel", "select", "error", "success", "renameChat", "deleteConfirm",
      "thinking", "regenerate"
    ];
    const result = {};
    keys.forEach(k => { result[k] = tRaw(k); });
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
  } = useConversation();

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

  const handleRenameFromSidebar = useCallback(
    async (id) => {
      const current = (conversations || []).find(c => c?.id === id);
      const nextTitle = window.prompt(t.renameChat, current?.title || "");
      if (nextTitle) {
        renameConversationOptimistic(id, nextTitle.trim());
        await renameConversation(id, nextTitle.trim());
      }
    },
    [conversations, renameConversation, renameConversationOptimistic, t]
  );

  const handleDeleteFromSidebar = useCallback(
    async (id) => {
      if (window.confirm(t.deleteConfirm)) {
        await deleteConversation(id);
        if (selectedConversationId === id) resetChatUI();
        await refreshConversations();
      }
    },
    [deleteConversation, refreshConversations, resetChatUI, selectedConversationId, t]
  );

  const currentConversation = useMemo(() => 
    (conversations || []).find(c => c?.id === selectedConversationId),
    [conversations, selectedConversationId]
  );

  const currentModel = currentConversation?.model || DEFAULT_MODEL;
  const currentGem = currentConversation?.gem || null;

  const handleModelChange = useCallback(
    async (newModel) => {
      if (!selectedConversationId) return;
      try {
        patchConversationModel?.(selectedConversationId, newModel);
        await setConversationModel?.(selectedConversationId, newModel);
      } catch (e) {
        console.error(e);
      }
    },
    [selectedConversationId, setConversationModel, patchConversationModel]
  );

  useEffect(() => {
    if (!isAuthLoading && !isAuthed) signIn();
  }, [isAuthed, isAuthLoading]);

  if (isAuthLoading || !isAuthed) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#020617] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 bg-black/60" />
        <div className="relative animate-pulse flex flex-col items-center gap-6 z-10">
           <div className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-center text-3xl font-black shadow-2xl">V</div>
           <div className="text-[10px] tracking-[0.4em] text-white/30 uppercase font-bold">{t.loading}</div>
        </div>
      </div>
    );
  }

  const showLanding = !selectedConversationId || renderedMessages.length === 0;

  return (
    <div className="h-screen w-screen bg-[#050505] text-neutral-100 overflow-hidden relative font-sans">
      
      {/* 🌌 Static Professional Background */}
      <div className="absolute inset-0 z-0 static-depth-bg pointer-events-none" />

      <Sidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(id) => { handleSelectConversation(id); closeMobileSidebar(); }}
        onNewChat={() => { handleNewChat(); closeMobileSidebar(); }}
        onDeleteConversation={handleDeleteFromSidebar}
        onRenameChat={handleRenameFromSidebar}
        onLogout={() => signOut()}
        t={t}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileSidebar}
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth">
          {showLanding ? (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
               <div className="mb-8 relative group">
                  <div className="absolute inset-0 bg-[var(--primary)] blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity duration-700" />
                  <div className="relative h-24 w-24 rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl flex items-center justify-center text-5xl font-black shadow-2xl text-white/90">V</div>
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
                 // Logic to determine if this message is the last AI message
                 const isLastAI = m.role === "assistant" && idx === renderedMessages.length - 1;
                 // Or we can allow regenerating any AI message?
                 // For now, let's just pass canRegenerate=true to ALL AI messages as requested
                 
                 return (
                  <ChatBubble 
                    key={m.id ?? idx} 
                    message={m} 
                    isLastAssistant={isLastAI} // Keep existing logic for "typing" effect
                    canRegenerate={m.role === "assistant"} // Allow regenerate on ALL AI messages
                    onRegenerate={() => handleRegenerate(m)} // Pass specific message if needed, or handleRegenerate logic
                    regenerating={regenerating && isLastAI} // Only show spinner on the last one if regenerating
                  />
                 );
              })}
              {streamingAssistant !== null && (
                <ChatBubble
                  message={{ role: "assistant", content: streamingAssistant, sources: streamingSources, urlContext: streamingUrlContext }}
                  isLastAssistant
                  canRegenerate={false} // Streaming msg cannot be regenerated yet
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
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={isStreaming || regenerating}
                className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 bg-transparent text-white/60 outline-none cursor-pointer hover:text-white transition-colors"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0f172a]">{t[m.id] || m.id}</option>
                ))}
              </select>

              <div className="h-3 w-[1px] bg-white/10 mx-1" />

              <button
                onClick={toggleWebSearch}
                className={`text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 transition-all rounded-full ${
                  webSearchEnabled ? "text-[var(--primary)] bg-white/5" : "text-white/40 hover:text-white"
                }`}
              >
                WEB {webSearchEnabled ? "ON" : "OFF"}
              </button>

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
                  conversationId={selectedConversationId}
                  disabled={creatingConversation || isStreaming || regenerating}
                  onAfterAnalyze={async () => { if (selectedConversationId) await handleSelectConversation(selectedConversationId); }}
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
          
          <div className="mt-3 text-center">
             <p className="text-[9px] font-bold text-white/10 tracking-widest uppercase hover:text-white/30 transition-colors cursor-default">
                {t.aiDisclaimer}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
