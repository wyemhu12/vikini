"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import ChatBubble from "./ChatBubble";
import Sidebar from "../Sidebar/Sidebar";
import HeaderBar from "../Layout/HeaderBar";
import InputForm from "./InputForm";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useSystemMode } from "../../hooks/useSystemMode";
import { useConversation } from "../../hooks/useConversation";
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
    loadingList,
    loadingMessages,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
  } = useConversation();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Assistant đang stream tạm thời
  const [streamingAssistant, setStreamingAssistant] = useState(null);

  const chatWindowRef = useRef(null);

  // ----------------------
  // AUTO SCROLL
  // ----------------------
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, streamingAssistant]);

  // ----------------------
  // GỘP MESSAGES + STREAMING
  // ----------------------
  const combinedMessages = useMemo(() => {
    if (streamingAssistant) return [...messages, streamingAssistant];
    return messages;
  }, [messages, streamingAssistant]);

  // ----------------------
  // FIND LAST ASSISTANT INDEX
  // ----------------------
  const lastAssistantIndex = useMemo(() => {
    return combinedMessages.reduce(
      (acc, msg, idx) => (msg.role === "assistant" ? idx : acc),
      -1
    );
  }, [combinedMessages]);

  const canRegenerate = lastAssistantIndex >= 0;

  // ----------------------
  // SEND MESSAGE
  // ----------------------
  const sendMessage = async (overrideText = null, isRegenerate = false) => {
    const raw = overrideText ?? input;
    const text = (raw || "").trim();
    if (!text) return;

    let conversationId = activeId;

    // Nếu chưa có conversation thì tạo mới
    if (!conversationId) {
      const conv = await createConversation(t.newChat || "New chat");
      if (!conv?.id) return; 
      conversationId = conv.id;
    }

    // Append user message vào UI (chưa cần Firestore)
    if (!isRegenerate) {
      const userMsg = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setInput("");
    setIsSending(!isRegenerate);
    setRegenerating(isRegenerate);

    // Tạo assistant tạm thời cho stream
    setStreamingAssistant({
      id: "assistant-stream",
      role: "assistant",
      content: "",
    });

    try {
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content: text,
          systemMode,
          language,
          isRegenerate,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      // Stream theo chunk
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        setStreamingAssistant((prev) =>
          prev
            ? { ...prev, content: fullText }
            : { id: "assistant-stream", role: "assistant", content: fullText }
        );
      }

      // Stream xong → xoá assistant tạm → load lại từ Firestore
      setStreamingAssistant(null);
      await loadConversation(conversationId);
    } catch (err) {
      console.error("❌ Chat stream error:", err);
      setStreamingAssistant(null);
    } finally {
      setIsSending(false);
      setRegenerating(false);
    }
  };

  // ----------------------
  // REGENERATE
  // ----------------------
  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    sendMessage(lastUser.content, true);
  };

  // ----------------------
  // AUTH UI
  // ----------------------
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950 text-white">
        <button
          onClick={() => signIn("google")}
          className="rounded-lg bg-white text-black px-4 py-2"
        >
          Login with Google
        </button>
      </div>
    );
  }

  // ----------------------
  // RENDER UI
  // ----------------------
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={conversations}
        activeId={activeId}
        onSelectChat={(id) => {
          setStreamingAssistant(null);
          setActiveId(id);
        }}
        onNewChat={async () => {
          const conv = await createConversation(t.newChat || "New chat");
          if (conv?.id) {
            setStreamingAssistant(null);
            setActiveId(conv.id);
            setMessages([]);
          }
        }}
        onRenameChat={async (id) => {
          const current = conversations.find((c) => c.id === id);
          const oldTitle = current?.title || t.newChat;
          const newTitle = window.prompt("Rename chat", oldTitle);
          if (newTitle?.trim()) {
            await renameConversation(id, newTitle.trim());
          }
        }}
        onDeleteChat={async (id) => {
          const ok = confirm("Delete this chat?");
          if (ok) await deleteConversation(id);
        }}
        onLogout={() => signOut()}
        t={t}
      />

      <div className="flex flex-col flex-1">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          systemMode={systemMode}
          onSystemModeChange={setSystemMode}
          theme={theme}
          onThemeChange={setTheme}
        />

        <div className="flex flex-col flex-1">
          <div
            ref={chatWindowRef}
            className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 py-6"
          >
            {loadingMessages ? (
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

          <div className="w-full max-w-3xl mx-auto">
            <InputForm
              input={input}
              onChangeInput={setInput}
              onSubmit={() => sendMessage()}
              disabled={!input.trim() || isSending || regenerating}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
