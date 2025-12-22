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

// Available models for selection - tên phải khớp chính xác với AI Studio
// ✅ Removed: gemini-2.0-flash, gemini-1.5-pro
const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash", descKey: "modelDescFlash25" },
  { id: "gemini-2.5-pro", descKey: "modelDescPro25" },
  { id: "gemini-3-flash", descKey: "modelDescFlash3" },
  { id: "gemini-3-pro", descKey: "modelDescPro3" },
];

const DEFAULT_MODEL = "gemini-2.5-flash";

const ALLOWED_MODEL_IDS = new Set(AVAILABLE_MODELS.map((m) => m.id));
function isAllowedModelId(modelId) {
  const m = String(modelId || "").trim();
  if (!m) return false;
  return ALLOWED_MODEL_IDS.has(m);
}

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

  // ✅ Build `t` đủ key cho HeaderBar + Chat UI
  const t = useMemo(() => {
    if (typeof tRaw === "function") {
      return {
        appName: tRaw("appName") ?? "Vikini",
        whitelist: tRaw("whitelist") ?? "",
        exploreGems: tRaw("exploreGems") ?? "Explore Gems",
        signOut: tRaw("signOut") ?? "Sign out",
        newChat: tRaw("newChat") ?? "New Chat",
        send: tRaw("send") ?? "Send",
        placeholder: tRaw("placeholder") ?? "Nhập tin nhắn...",
        refresh: tRaw("refresh") ?? "Refresh",
        deleteAll: tRaw("deleteAll") ?? "Delete all",
        logout: tRaw("logout") ?? "Log out",
        // Model selector
        modelSelector: tRaw("modelSelector") ?? "Model",
        selectModel: tRaw("selectModel") ?? "Select Model",
        currentModel: tRaw("currentModel") ?? "Current Model",
        // Applied GEM
        appliedGem: tRaw("appliedGem") ?? "Applied GEM",
        appliedGemNone: tRaw("appliedGemNone") ?? "None",
        // Model names - tên phải khớp chính xác với AI Studio
        "gemini-2.5-flash": tRaw("gemini-2.5-flash") ?? "Gemini 2.5 Flash",
        "gemini-2.5-pro": tRaw("gemini-2.5-pro") ?? "Gemini 2.5 Pro",
        "gemini-3-flash": tRaw("gemini-3-flash") ?? "Gemini 3 Flash",
        "gemini-3-pro": tRaw("gemini-3-pro") ?? "Gemini 3 Pro",
        // Model descriptions
        modelDescFlash25: tRaw("modelDescFlash25") ?? "Fast & balanced",
        modelDescPro25: tRaw("modelDescPro25") ?? "Advanced thinking",
        modelDescFlash3: tRaw("modelDescFlash3") ?? "Smart & fast",
        modelDescPro3: tRaw("modelDescPro3") ?? "Most intelligent",
        // Web search
        webSearch: tRaw("webSearch") ?? "Web Search",
        webSearchOn: tRaw("webSearchOn") ?? "ON",
        webSearchOff: tRaw("webSearchOff") ?? "OFF",
      };
    }

    if (tRaw && typeof tRaw === "object") {
      return {
        appName: tRaw.appName ?? "Vikini",
        whitelist: tRaw.whitelist ?? "",
        exploreGems: tRaw.exploreGems ?? "Explore Gems",
        signOut: tRaw.signOut ?? "Sign out",
        newChat: tRaw.newChat ?? "New Chat",
        send: tRaw.send ?? "Send",
        placeholder: tRaw.placeholder ?? "Nhập tin nhắn...",
        refresh: tRaw.refresh ?? "Refresh",
        deleteAll: tRaw.deleteAll ?? "Delete all",
        logout: tRaw.logout ?? tRaw.signOut ?? "Log out",
        // Model selector
        modelSelector: tRaw.modelSelector ?? "Model",
        selectModel: tRaw.selectModel ?? "Select Model",
        currentModel: tRaw.currentModel ?? "Current Model",
        // Applied GEM
        appliedGem: tRaw.appliedGem ?? "Applied GEM",
        appliedGemNone: tRaw.appliedGemNone ?? "None",
        // Model names
        "gemini-2.5-flash": tRaw["gemini-2.5-flash"] ?? "Gemini 2.5 Flash",
        "gemini-2.5-pro": tRaw["gemini-2.5-pro"] ?? "Gemini 2.5 Pro",
        "gemini-3-flash": tRaw["gemini-3-flash"] ?? "Gemini 3 Flash",
        "gemini-3-pro": tRaw["gemini-3-pro"] ?? "Gemini 3 Pro",
        // Model descriptions
        modelDescFlash25: tRaw.modelDescFlash25 ?? "Fast & balanced",
        modelDescPro25: tRaw.modelDescPro25 ?? "Advanced thinking",
        modelDescFlash3: tRaw.modelDescFlash3 ?? "Smart & fast",
        modelDescPro3: tRaw.modelDescPro3 ?? "Most intelligent",
        // Web search
        webSearch: tRaw.webSearch ?? "Web Search",
        webSearchOn: tRaw.webSearchOn ?? "ON",
        webSearchOff: tRaw.webSearchOff ?? "OFF",
        ...tRaw,
      };
    }

    return {
      appName: "Vikini",
      whitelist: "",
      exploreGems: "Explore Gems",
      signOut: "Sign out",
      newChat: "New Chat",
      send: "Send",
      placeholder: "Nhập tin nhắn...",
      refresh: "Refresh",
      deleteAll: "Delete all",
      logout: "Log out",
      // Model selector
      modelSelector: "Model",
      selectModel: "Select Model",
      currentModel: "Current Model",
      // Applied GEM
      appliedGem: "Applied GEM",
      appliedGemNone: "None",
      // Model names
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.5-pro": "Gemini 2.5 Pro",
      "gemini-3-flash": "Gemini 3 Flash",
      "gemini-3-pro": "Gemini 3 Pro",
      // Model descriptions
      modelDescFlash25: "Fast & balanced",
      modelDescPro25: "Advanced thinking",
      modelDescFlash3: "Smart & fast",
      modelDescPro3: "Most intelligent",
      // Web search
      webSearch: "Web Search",
      webSearchOn: "ON",
      webSearchOff: "OFF",
    };
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

  // ✅ Wire rename/delete để Sidebar không dùng fallback API calls
  const handleRenameFromSidebar = useCallback(
    async (id) => {
      try {
        const current = (Array.isArray(conversations) ? conversations : []).find(
          (c) => c?.id === id
        );
        const curTitle = current?.title || "";
        const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
        if (nextTitle === null) return;
        const title = String(nextTitle).trim();
        if (!title) return;

        renameConversationOptimistic(id, title);
        await renameConversation(id, title);
      } catch (e) {
        console.error(e);
        alert("Không đổi tên được. Vui lòng thử lại.");
      }
    },
    [conversations, renameConversation, renameConversationOptimistic]
  );

  const handleDeleteFromSidebar = useCallback(
    async (id) => {
      try {
        const ok = window.confirm("Xoá cuộc hội thoại này?");
        if (!ok) return;

        await deleteConversation(id);

        if (selectedConversationId === id) {
          resetChatUI();
        }

        await refreshConversations();
      } catch (e) {
        console.error(e);
        alert("Không xoá được. Vui lòng thử lại.");
      }
    },
    [deleteConversation, refreshConversations, resetChatUI, selectedConversationId]
  );

  // ✅ Get current conversation info for Applied GEM and Model display
  const currentConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return (Array.isArray(conversations) ? conversations : []).find(
      (c) => c?.id === selectedConversationId
    );
  }, [conversations, selectedConversationId]);

  const currentModelRaw = currentConversation?.model || DEFAULT_MODEL;
  const currentModel = isAllowedModelId(currentModelRaw) ? currentModelRaw : DEFAULT_MODEL;
  const currentGem = currentConversation?.gem || null;

  // ✅ Auto-migrate old/unsupported model values (Gemini 1.5 / 2.0) to DEFAULT_MODEL
  useEffect(() => {
    if (!selectedConversationId) return;
    const raw = currentConversation?.model;

    // Only migrate if a model is explicitly set but not allowed
    if (!raw) return;
    if (isAllowedModelId(raw)) return;

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
      if (!isAllowedModelId(next)) return;
      if (next === currentModel) return;

      try {
        // Optimistic update
        patchConversationModel?.(selectedConversationId, next);
        // Server update
        await setConversationModel?.(selectedConversationId, next);
      } catch (e) {
        console.error("Failed to change model:", e);
        // Revert on error
        patchConversationModel?.(selectedConversationId, currentModel);
      }
    },
    [selectedConversationId, currentModel, setConversationModel, patchConversationModel]
  );

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-200">
        Loading...
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-200">
        <div className="text-lg font-semibold mb-2">Vikini</div>
        <div className="text-sm text-neutral-400 mb-6">
          Vui lòng đăng nhập để tiếp tục.
        </div>
        <button
          onClick={() => signIn("google")}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Đăng nhập bằng Google
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100">
      {/* Sidebar (fixed desktop + mobile drawer) */}
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
        // ✅ Không truyền onRefresh để không render nút Refresh
        onDeleteConversation={handleDeleteFromSidebar}
        onRenameChat={handleRenameFromSidebar}
        // ✅ Di chuyển Sign out vào Sidebar
        onLogout={() => signOut()}
        t={t}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileSidebar}
      />

      {/* Main content: add left padding on desktop to avoid overlap with fixed sidebar */}
      <div className="h-full flex flex-col md:pl-64">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          theme={theme}
          onThemeChange={toggleTheme}
          onToggleSidebar={toggleMobileSidebar}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 md:px-6 py-6">
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
        </div>

        <div className="max-w-3xl mx-auto w-full">
          <div className="px-4 pt-1 flex flex-wrap items-center gap-2">
            {/* ✅ Model Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500 hidden sm:inline">
                {t.modelSelector}:
              </span>
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={!selectedConversationId || isStreaming || regenerating}
                className="text-xs px-2 py-1.5 rounded-full ring-1 ring-neutral-700 bg-neutral-900 text-neutral-100 outline-none focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                title={t.selectModel}
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t[m.id] || m.id}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ Keep Web Search toggle UI */}
            <button
              onClick={toggleWebSearch}
              className={[
                "text-xs px-3 py-1.5 rounded-full ring-1 transition",
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

            {/* ✅ Applied GEM Indicator */}
            <div
              className="text-xs px-3 py-1.5 rounded-full ring-1 ring-neutral-800 bg-neutral-950 text-neutral-400"
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

          {/* ✅ BỎ footer New Chat + Ready (nút dư) */}
        </div>
      </div>
    </div>
  );
}
