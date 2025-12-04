"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../Sidebar/Sidebar";
import HeaderBar from "../Layout/HeaderBar";
import InputForm from "./InputForm";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useSystemMode } from "../../hooks/useSystemMode";
import { translations, getSystemPrompt, createChat } from "../../utils/config";

export default function ChatApp() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();
  const t = translations[language];

  const [chats, setChats] = useState([createChat(language)]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const chatWindowRef = useRef(null);

  const activeChat = chats.find((c) => c.id === activeId) || null;

  // Auto-scroll
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeChat?.messages?.length, isSending, regenerating]);

  // Set first chat as active
  useEffect(() => {
    if (!activeId && chats.length > 0) setActiveId(chats[0].id);
  }, [chats, activeId]);

  // ----------------------
  // SEND MESSAGE
  // ----------------------
  const sendMessage = async (overrideText = null, isRegenerate = false) => {
    const text = overrideText || input.trim();
    if (!text) return;

    const userMsg =
      !isRegenerate
        ? { id: Date.now(), role: "user", content: text }
        : null;

    if (!isRegenerate) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeId
            ? { ...chat, messages: [...chat.messages, userMsg] }
            : chat
        )
      );
    }

    setInput("");
    setIsSending(!isRegenerate);
    setRegenerating(isRegenerate);

    try {
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: isRegenerate
            ? activeChat.messages
            : activeChat.messages.concat(userMsg),
          systemMode,
          language,
        }),
      });

      if (!res.ok) throw new Error("Stream error");

      const reader = res.body.getReader();
      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        assistantContent += new TextDecoder().decode(value);

        setChats((prev) =>
          prev.map((chat) =>
            chat.id === activeId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages.filter(
                      (m) => !(m.role === "assistant" && m.id === "stream")
                    ),
                    {
                      id: "stream",
                      role: "assistant",
                      content: assistantContent,
                    },
                  ],
                }
              : chat
          )
        );
      }
    } catch (err) {
      console.error("Chat stream failed:", err);
    } finally {
      setIsSending(false);
      setRegenerating(false);
    }
  };

  // REGENERATE LAST ASSISTANT ===> Lấy tin user cuối và gửi lại
  const handleRegenerate = () => {
    const lastUser = [...activeChat.messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUser) return;

    sendMessage(lastUser.content, true);
  };

  // ----------------------
  // LAST ASSISTANT INDEX
  // ----------------------
  const lastAssistantIndex = (() => {
    if (!activeChat) return -1;
    return activeChat.messages.reduce(
      (acc, m, idx) => (m.role === "assistant" ? idx : acc),
      -1
    );
  })();

  const canRegenerate = lastAssistantIndex >= 0;

  // ----------------------
  // RENDER UI
  // ----------------------
  if (!session)
    return (
      <div className="flex h-screen items-center justify-center">
        <button
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-black"
          onClick={() => signIn("google")}
        >
          Login with Google
        </button>
      </div>
    );

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={chats}
        activeId={activeId}
        onSelectChat={setActiveId}
        onNewChat={() => {
          const c = createChat(language);
          setChats((prev) => [c, ...prev]);
          setActiveId(c.id);
        }}
        t={t}
      />

      <div className="flex flex-1 flex-col">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          systemMode={systemMode}
          onSystemModeChange={setSystemMode}
          theme={theme}
          onThemeChange={setTheme}
        />

        <div className="chat-gradient flex flex-1 flex-col">
          <div
            ref={chatWindowRef}
            className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6"
          >
            <div className="flex flex-col space-y-6 text-sm sm:text-base leading-relaxed">
              {activeChat.messages.map((msg, idx) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isLastAssistant={idx === lastAssistantIndex}
                  canRegenerate={canRegenerate}
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                />
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl">
            <InputForm
              input={input}
              onChangeInput={setInput}
              onSubmit={() => sendMessage()}
              disabled={!input.trim() || isSending}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
