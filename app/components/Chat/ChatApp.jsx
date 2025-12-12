// app/components/Chat/ChatApp.jsx
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

  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();
  const t = translations[language];

  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    setMessages,
    loadConversation,
    renameConversation,
    deleteConversation,
    upsertConversation,
    patchConversationTitle,
  } = useConversation();

  const [input, setInput] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [draftActive, setDraftActive] = useState(false);

  const chatWindowRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const el = chatWindowRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages, streamingAssistant]);

  const combinedMessages = streamingAssistant
    ? [...messages, streamingAssistant]
    : messages;

  const { sendMessage, isStreaming } = useChat({
    onConversationCreated: (conv) => {
      setDraftActive(false);
      upsertConversation(conv);
      setActiveId(conv.id);
      setMessages([]);
    },
    onAssistantDelta: (delta) => {
      setStreamingAssistant((p) => ({
        id: "assistant-stream",
        role: "assistant",
        content: (p?.content || "") + delta,
      }));
    },
    onStreamDone: (full) => {
      setStreamingAssistant(null);
      if (full.trim()) {
        setMessages((m) => [
          ...m,
          { id: Date.now(), role: "assistant", content: full.trim() },
        ]);
      }
    },
    onFinalTitle: patchConversationTitle,
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setMessages((m) => [...m, { id: Date.now(), role: "user", content: text }]);
    setStreamingAssistant({ id: "assistant-stream", role: "assistant", content: "" });

    await sendMessage({
      conversationId: draftActive ? null : activeId,
      content: text,
      systemMode,
    });
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <button onClick={() => signIn("google")}>Login</button>
      </div>
    );
  }

  const sidebarChats = draftActive
    ? [{ id: "__draft__", title: "New Chat", draft: true }, ...conversations]
    : conversations;

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={sidebarChats}
        activeId={draftActive ? "__draft__" : activeId}
        onNewChat={() => {
          setDraftActive(true);
          setActiveId(null);
          setMessages([]);
        }}
        onSelectChat={(id) => {
          if (id === "__draft__") return;
          setDraftActive(false);
          setActiveId(id);
          loadConversation(id);
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

        <div ref={chatWindowRef} className="flex-1 overflow-y-auto p-6">
          {combinedMessages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}
        </div>

        <InputForm
          input={input}
          onChangeInput={setInput}
          onSubmit={handleSend}
          disabled={!input.trim() || isStreaming || regenerating}
          t={t}
        />
      </div>
    </div>
  );
}
