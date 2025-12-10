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

import useAutoTitleStore from "@/app/hooks/useAutoTitleStore";
import { translations } from "../../utils/config";

export default function ChatApp() {
  const { data: session } = useSession();

  // Global settings
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();
  const t = translations[language];

  // Conversation state
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
  } = useConversation();

  // Auto-title store (Zustand)
  const setOptimisticTitle = useAutoTitleStore((s) => s.setOptimisticTitle);
  const setFinalTitle = useAutoTitleStore((s) => s.setFinalTitle);
  const setTitleLoading = useAutoTitleStore((s) => s.setTitleLoading);

  // Chat states
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState(null);

  const chatWindowRef = useRef(null);

  // ---------------------------
  // OPTIMIZED scroll to bottom
  // ---------------------------
  const scrollToBottom = useCallback(() => {
    const el = chatWindowRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Scroll only when new message appended OR streaming updates final chunk
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingAssistant, scrollToBottom]);

  // -----------------------------------
  // Combine messages (zero re-render)
  // -----------------------------------
  const combinedMessages = streamingAssistant
    ? [...messages, streamingAssistant]
    : messages;

  // Optimized last assistant index
  const lastAssistantIndex = useMemo(() => {
    for (let i = combinedMessages.length - 1; i >= 0; i--) {
      if (combinedMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [combinedMessages]);

  const canRegenerate = lastAssistantIndex >= 0;

  // ================================================================
  // SEND MESSAGE — optimized streaming + Zustand auto-title handling
  // ================================================================
  const sendMessage = async (overrideText = null, isRegenerate = false) => {
    const raw = overrideText ?? input;
    const text = (raw || "").trim();
    if (!text) return;

    setInput("");

    let conversationId = activeId;
    let isBrandNew = false;

    if (!conversationId) {
      const conv = await createConversation({ title: "New Chat" });
      if (!conv?.id) return;
      conversationId = conv.id;
      setActiveId(conv.id);
      isBrandNew = true;
    }

    // Append user message for UI
    if (!isRegenerate) {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: text },
      ]);
    }

    // Placeholder assistant
    setIsSending(!isRegenerate);
    setRegenerating(isRegenerate);

    setStreamingAssistant({
      id: "assistant-stream",
      role: "assistant",
      content: "",
    });

    // Status for auto-title
    setTitleLoading(conversationId, true);

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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Handle metadata block ($$META:{...}$$)
        if (chunk.includes("$$META:")) {
          const parts = chunk.split("$$META:");
          for (const p of parts) {
            if (!p.includes("$$")) continue;
            const jsonStr = p.split("$$")[0];
            try {
              const meta = JSON.parse(jsonStr);
              if (meta.type === "optimisticTitle")
                setOptimisticTitle(meta.conversationId, meta.title);
              if (meta.type === "finalTitle")
                setFinalTitle(meta.conversationId, meta.title);
            } catch {}
          }
          continue;
        }

        // Streaming assistant merging
        full += chunk;

        setStreamingAssistant({
          id: "assistant-stream",
          role: "assistant",
          content: full,
        });
      }

      // End streaming → commit final assistant message
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
    } catch (err) {
      console.error("Stream error:", err);
      setStreamingAssistant(null);
    } finally {
      setIsSending(false);
      setRegenerating(false);
      setTitleLoading(conversationId, false);
    }
  };

  // Regenerate response
  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) sendMessage(lastUser.content, true);
  };

  // ---------------------------
  // LOGIN GATE
  // ---------------------------
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

  // ---------------------------
  // MAIN LAYOUT
  // ---------------------------
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Sidebar
        chats={conversations}
        activeId={activeId}
        onSelectChat={(id) => {
          setStreamingAssistant(null);
          setActiveId(id);
        }}
        onNewChat={async () => {
          const conv = await createConversation({ title: "New Chat" });
          if (conv?.id) {
            setStreamingAssistant(null);
            setActiveId(conv.id);
            setMessages([]);
          }
        }}
        onRenameChat={renameConversation}
        onDeleteChat={deleteConversation}
        onLogout={() => signOut()}
        t={t}
      />

      {/* RIGHT PANEL */}
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

        {/* CHAT WINDOW */}
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

        {/* INPUT AREA */}
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
