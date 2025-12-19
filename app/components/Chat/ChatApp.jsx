// /app/components/Chat/ChatApp.jsx
"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../Sidebar/Sidebar";
import HeaderBar from "../Layout/HeaderBar";
import InputForm from "./InputForm";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useConversation } from "../../hooks/useConversation";

import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";

export default function ChatApp() {
  const { data: session, status } = useSession();

  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();

  // ✅ Không còn System Mode / mode prompt
  const systemMode = "default";

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

    systemMode,
    language,

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
          <div className="px-4 pt-1 flex items-center justify-between">
            {/* ✅ Keep Web Search toggle UI */}
            <button
              onClick={toggleWebSearch}
              className={[
                "text-xs px-3 py-1.5 rounded-full ring-1 transition",
                webSearchEnabled
                  ? "bg-neutral-900 ring-neutral-700 text-neutral-100"
                  : "bg-neutral-950 ring-neutral-800 text-neutral-400 hover:text-neutral-200",
              ].join(" ")}
              title="Bật/Tắt Web Search"
              type="button"
            >
              Web Search: {webSearchEnabled ? "ON" : "OFF"}
              {webSearchEnabled ? serverHint : ""}
            </button>

            {/* ✅ BỎ Sign out khỏi main area (đã chuyển vào sidebar) */}
          </div>

          <InputForm
            input={input}
            onChangeInput={setInput}
            onSubmit={() => handleSend()}
            disabled={creatingConversation || !input.trim() || isStreaming || regenerating}
            t={t}
          />

          {/* ✅ BỎ footer New Chat + Ready (nút dư) */}
        </div>
      </div>
    </div>
  );
}
