// /app/components/Chat/ChatApp.jsx
"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../Sidebar/Sidebar";
import HeaderBar from "../Layout/HeaderBar";
import InputForm from "./InputForm";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useSystemMode } from "../../hooks/useSystemMode";
import { useConversation } from "../../hooks/useConversation";

import { useWebSearchPreference } from "./hooks/useWebSearchPreference";
import { useChatStreamController } from "./hooks/useChatStreamController";

export default function ChatApp() {
  const { data: session, status } = useSession();

  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t: tRaw } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();

  const t = useMemo(() => {
    if (typeof tRaw === "function") {
      return {
        signOut: tRaw("signOut") ?? "Sign out",
        newChat: tRaw("newChat") ?? "New Chat",
        send: tRaw("send") ?? "Send",
        placeholder: tRaw("placeholder") ?? "Nhập tin nhắn...",
      };
    }
    if (tRaw && typeof tRaw === "object") {
      return {
        signOut: tRaw.signOut ?? "Sign out",
        newChat: tRaw.newChat ?? "New Chat",
        send: tRaw.send ?? "Send",
        placeholder: tRaw.placeholder ?? "Nhập tin nhắn...",
        ...tRaw,
      };
    }
    return {
      signOut: "Sign out",
      newChat: "New Chat",
      send: "Send",
      placeholder: "Nhập tin nhắn...",
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

    // ✅ add these two
    renameConversation,
    deleteConversation,
  } = useConversation(); // :contentReference[oaicite:5]{index=5}

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

  // ✅ Wire rename/delete so Sidebar won't use fallback logic
  const handleRenameFromSidebar = useCallback(
    async (id) => {
      try {
        const current = (Array.isArray(conversations) ? conversations : []).find((c) => c?.id === id);
        const curTitle = current?.title || "";
        const nextTitle = window.prompt("Đổi tên cuộc hội thoại:", curTitle);
        if (nextTitle === null) return;

        const title = String(nextTitle).trim();
        if (!title) return;

        // Optimistic first
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

        // Optimistic delete in hook (updates sidebar immediately)
        await deleteConversation(id);

        // If deleting currently opened conversation, clear UI messages immediately
        if (selectedConversationId === id) {
          resetChatUI();
        }

        // Best-effort revalidate
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
        <div className="text-sm text-neutral-400 mb-6">Vui lòng đăng nhập để tiếp tục.</div>
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
    <div className="h-screen w-screen flex bg-neutral-950 text-neutral-100">
      <Sidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRefresh={refreshConversations}
        // ✅ Important: wire actions to avoid Sidebar fallback
        onDeleteConversation={handleDeleteFromSidebar}
        onRenameChat={handleRenameFromSidebar}
        t={t}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar
          theme={theme}
          toggleTheme={toggleTheme}
          language={language}
          setLanguage={setLanguage}
          systemMode={systemMode}
          setSystemMode={setSystemMode}
          onSignOut={() => signOut()}
          t={t}
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

            <button
              onClick={() => signOut()}
              className="text-xs text-neutral-500 hover:text-neutral-200"
              type="button"
            >
              {t.signOut}
            </button>
          </div>

          <InputForm
            input={input}
            onChangeInput={setInput}
            onSubmit={() => handleSend()}
            disabled={creatingConversation || !input.trim() || isStreaming || regenerating}
            t={t}
          />

          <div className="px-4 pb-3 flex items-center justify-between text-xs text-neutral-500">
            <button onClick={handleNewChat} className="hover:text-neutral-200" type="button">
              {t.newChat}
            </button>

            <div className="text-neutral-600">{isStreaming ? "Streaming..." : "Ready"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
