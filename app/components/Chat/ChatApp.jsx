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
    loadingMessages,
    loadConversation,
    loadConversations,
    createConversation,
    renameConversation,
    deleteConversation,
  } = useConversation();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState(null);

  // Auto-title UI states
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);

  const chatWindowRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, streamingAssistant]);

  // Merge streaming assistant message with existing messages
  const combinedMessages = useMemo(() => {
    if (streamingAssistant) return [...messages, streamingAssistant];
    return messages;
  }, [messages, streamingAssistant]);

  // Find last assistant msg index
  const lastAssistantIndex = useMemo(
    () =>
      combinedMessages.reduce(
        (acc, m, idx) => (m.role === "assistant" ? idx : acc),
        -1
      ),
    [combinedMessages]
  );

  const canRegenerate = lastAssistantIndex >= 0;

  // SEND MESSAGE — handles auto-title
  const sendMessage = async (overrideText = null, isRegenerate = false) => {
    const raw = overrideText ?? input;
    const text = (raw || "").trim();
    if (!text) return;

    setInput("");

    let conversationId = activeId;
    let isBrandNew = false;

    // Create conversation if needed
    if (!conversationId) {
      const conv = await createConversation({
        title: "New chat",
        autoTitled: false,
      });
      if (!conv?.id) return;

      conversationId = conv.id;
      setActiveId(conv.id);
      isBrandNew = true;
    }

    // Read freshest conversation meta
    const getFreshConversation = () =>
      conversations.find((c) => c.id === conversationId) || null;

    let meta = getFreshConversation();

    // Determine if we need auto-title
    let shouldTrackAutoTitle =
      isBrandNew ||
      (meta && !meta.autoTitled && !meta.renamed);

    if (!isRegenerate) {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, role: "user", content: text },
      ]);
    }

    setIsSending(!isRegenerate);
    setRegenerating(isRegenerate);

    // Streaming placeholder
    setStreamingAssistant({
      id: "assistant-stream",
      role: "assistant",
      content: "",
    });

    if (shouldTrackAutoTitle) {
      setTitleGeneratingId(conversationId);
      setTitleLoading(true);
    }

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

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      // STREAM LOOP
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;

        setStreamingAssistant({
          id: "assistant-stream",
          role: "assistant",
          content: full,
        });
      }

      setStreamingAssistant(null);

      // Reload conversation messages
      await loadConversation(conversationId);
    } catch (err) {
      console.error("Chat stream error:", err);
      setStreamingAssistant(null);
    } finally {
      setIsSending(false);
      setRegenerating(false);

      if (shouldTrackAutoTitle) {
        try {
          await loadConversations(); // Fetch newest title from Firestore
        } catch (e) {
          console.error("Reload conversations failed:", e);
        }

        setTitleLoading(false);
        setTitleGeneratingId(null);
      }
    }
  };

  // REGENERATE LAST ASSISTANT REPLY
  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content, true);
  };

  // LOGIN PROMPT
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

  // RENDER MAIN UI
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      {/* FIXED SIDEBAR */}
      <Sidebar
        chats={conversations}
        activeId={activeId}
        onSelectChat={(id) => {
          setStreamingAssistant(null);
          setActiveId(id);
        }}
        onNewChat={async () => {
          const conv = await createConversation({
            title: "New chat",
            autoTitled: false,
          });
          if (conv?.id) {
            setStreamingAssistant(null);
            setActiveId(conv.id);
            setMessages([]);
          }
        }}
        onRenameChat={async (id) => {
          const current = conversations.find((c) => c.id === id);
          const old = current?.title || "New chat";
          const newTitle = window.prompt("Rename chat", old);
          if (newTitle?.trim()) await renameConversation(id, newTitle.trim());
        }}
        onDeleteChat={async (id) => {
          if (confirm("Delete this chat?")) await deleteConversation(id);
        }}
        onLogout={() => signOut()}
        t={t}
        titleLoading={titleLoading}
        titleGeneratingId={titleGeneratingId}
      />

      {/* MAIN PANEL */}
      <div className="flex flex-col flex-1 ml-64">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          systemMode={systemMode}
          onSystemModeChange={setSystemMode}
          theme={theme}
          onThemeChange={setTheme}
        />

        {/* CHAT SCROLL AREA */}
        <div
          ref={chatWindowRef}
          className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-3xl mx-auto"
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

        {/* INPUT FORM STICKY BOTTOM */}
        <div className="sticky bottom-0 bg-neutral-950">
          <div className="max-w-3xl w-full mx-auto">
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
