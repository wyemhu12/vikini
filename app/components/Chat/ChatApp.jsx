"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../Sidebar/Sidebar";
import HeaderBar from "../Layout/HeaderBar";
import InputForm from "./InputForm";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useSystemMode } from "../../hooks/useSystemMode";
import { useConversation } from "../../hooks/useConversation";
import useChat from "../../hooks/useChat";

import { translations } from "../../utils/config";

export default function ChatApp() {
  const { data: session } = useSession();

  // App settings
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();
  const t = translations[language];

  // Conversations
  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    setMessages,
    loadingMessages,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    upsertConversation,
    patchConversationTitle,
  } = useConversation();

  // Chat UI state
  const [input, setInput] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const chatWindowRef = useRef(null);

  // Scroll
  const scrollToBottom = useCallback(() => {
    const el = chatWindowRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingAssistant, scrollToBottom]);

  // Combine messages
  const combinedMessages = streamingAssistant
    ? [...messages, streamingAssistant]
    : messages;

  const lastAssistantIndex = useMemo(() => {
    for (let i = combinedMessages.length - 1; i >= 0; i--) {
      if (combinedMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [combinedMessages]);

  const canRegenerate = lastAssistantIndex >= 0;

  // ===============================
  // useChat — STREAM ENGINE
  // ===============================
  const { sendMessage, isStreaming } = useChat({
    onConversationCreated: (conv) => {
      upsertConversation(conv);
      setActiveId(conv.id);
    },

    onAssistantDelta: (delta) => {
      setStreamingAssistant((prev) => ({
        id: "assistant-stream",
        role: "assistant",
        content: (prev?.content || "") + delta,
      }));
    },

    onStreamDone: (full) => {
      setStreamingAssistant(null);
      if (full.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: full.trim(),
          },
        ]);
      }
    },

    onFinalTitle: (id, title) => {
      patchConversationTitle(id, title);
    },
  });

  // ===============================
  // SEND MESSAGE
  // ===============================
  const handleSend = async (override = null, isRegenerate = false) => {
    const text = (override ?? input).trim();
    if (!text) return;

    setInput("");
    setRegenerating(isRegenerate);

    let conversationId = activeId;

    if (!conversationId) {
      // Không tạo conversation ở đây nữa
      // chat-stream sẽ tạo và gửi META conversationCreated
      conversationId = null;
    }

    if (!isRegenerate) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: text },
      ]);
    }

    setStreamingAssistant({
      id: "assistant-stream",
      role: "assistant",
      content: "",
    });

    await sendMessage({
      conversationId,
      content: text,
      systemMode,
    });

    setRegenerating(false);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) handleSend(lastUser.content, true);
  };

  // Login
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <button
          onClick={() => signIn("google")}
          className="rounded-lg bg-white px-4 py-2"
        >
          Login with Google
        </button>
      </div>
    );
  }

  // ===============================
  // UI
  // ===============================
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={conversations}
        activeId={activeId}
        onSelectChat={(id) => {
          setStreamingAssistant(null);
          setActiveId(id);
          loadConversation(id);
        }}
        onNewChat={() => {
          setActiveId(null);
          setMessages([]);
        }}
        onRenameChat={renameConversation}
        onDeleteChat={deleteConversation}
        onLogout={() => signOut()}
        t={t}
      />

      <div className="flex flex-col flex-1 ml-64">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          systemMode={systemMode}
          onSystemModeChange={setSystemMode}
          onThemeChange={setTheme}
          theme={theme}
        />

        <div
          ref={chatWindowRef}
          className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-3xl mx-auto"
        >
          {loadingMessages && combinedMessages.length === 0 ? (
            <div className="text-center text-neutral-300">Loading…</div>
          ) : (
            <div className="flex flex-col space-y-6">
              {combinedMessages.map((msg, idx) => (
                <ChatBubble
                  key={msg.id ?? idx}
                  message={msg}
                  isLastAssistant={idx === lastAssistantIndex}
                  canRegenerate={canRegenerate}
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                />
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-neutral-950">
          <div className="max-w-3xl mx-auto w-full">
            <InputForm
              input={input}
              onChangeInput={setInput}
              onSubmit={() => handleSend()}
              disabled={!input.trim() || isStreaming || regenerating}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
