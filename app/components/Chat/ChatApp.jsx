// /app/components/Chat/ChatApp.jsx
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

import { tVi, tEn } from "../../utils/config";

export default function ChatApp() {
  const { data: session, status } = useSession();

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();

  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    creatingConversation,
    renameConversationOptimistic,
    renameConversationFinal,
    deleteConversation,
    deleteAllConversations,
    refreshConversations,
  } = useConversation();

  const [input, setInput] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  // ===============================
  // WEB SEARCH TOGGLE (client-side)
  // - Stored in localStorage + cookie
  // - Backend reads cookie (keeps payload minimal)
  // ===============================
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const getCookie = useCallback((name) => {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const c of cookies) {
      const [k, ...rest] = c.split("=");
      if (k === name) return decodeURIComponent(rest.join("="));
    }
    return null;
  }, []);

  const setCookie = useCallback((name, value) => {
    if (typeof document === "undefined") return;
    // 1 year, site-wide, Lax
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  useEffect(() => {
    try {
      const ls = localStorage.getItem("vikini.webSearch");
      if (ls === "1" || ls === "0") {
        const enabled = ls === "1";
        setWebSearchEnabled(enabled);
        setCookie("vikini_web_search", enabled ? "1" : "0");
        return;
      }

      // Fallback to cookie (if exists)
      const c = getCookie("vikini_web_search");
      if (c === "1" || c === "0") {
        setWebSearchEnabled(c === "1");
      }
    } catch {
      // ignore
    }
  }, [getCookie, setCookie]);

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vikini.webSearch", next ? "1" : "0");
      } catch {}
      setCookie("vikini_web_search", next ? "1" : "0");
      return next;
    });
  }, [setCookie]);

  const isAuthLoading = status === "loading";
  const isAuthed = !!session?.user?.email;

  const t = useMemo(() => (language === "en" ? tEn : tVi), [language]);

  const scrollRef = useRef(null);

  const [messages, setMessages] = useState([]);

  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingAssistant]);

  const handleNewChat = async () => {
    const conv = await createConversation();
    if (conv?.id) {
      setSelectedConversationId(conv.id);
      setMessages([]);
      setStreamingAssistant(null);
      setInput("");
    }
  };

  const handleSelectConversation = async (id) => {
    setSelectedConversationId(id);
    setStreamingAssistant(null);
    setInput("");

    try {
      const res = await fetch(`/api/conversations?conversationId=${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async (overrideText) => {
    if (!isAuthed) return;
    if (creatingConversation) return;

    const text = (overrideText ?? input).trim();
    if (!text) return;

    setInput("");
    setIsStreaming(true);
    setStreamingAssistant("");

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    let convId = selectedConversationId;

    if (!convId) {
      const conv = await createConversation();
      convId = conv?.id;
      if (convId) setSelectedConversationId(convId);
    }

    try {
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          content: text,
          systemMode,
          language,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const lines = part.split("\n").filter(Boolean);
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          const event = eventLine?.replace("event:", "").trim();
          const dataStr = dataLine?.replace("data:", "").trim();

          if (!event || !dataStr) continue;

          let data;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (event === "token") {
            const t = data?.t || "";
            if (!t) continue;
            setStreamingAssistant((prev) => (prev || "") + t);
          }

          if (event === "meta") {
            if (data?.type === "conversationCreated" && data?.conversation?.id) {
              setSelectedConversationId(data.conversation.id);
              await refreshConversations();
            }

            if (data?.type === "optimisticTitle" && data?.title) {
              renameConversationOptimistic(
                data.conversationId,
                data.title || "New Chat"
              );
            }

            if (data?.type === "finalTitle" && data?.title) {
              renameConversationFinal(
                data.conversationId,
                data.title || "New Chat"
              );
            }
          }

          if (event === "done") {
            // will exit loop naturally
          }
        }
      }

      const finalAssistant = streamingAssistantRef.current || "";
      const assistantMsg = { role: "assistant", content: finalAssistant };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingAssistant(null);
    } catch (e) {
      console.error(e);
      setStreamingAssistant(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const streamingAssistantRef = useRef(streamingAssistant);
  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  const handleRegenerate = async () => {
    if (!selectedConversationId) return;
    if (isStreaming) return;

    setRegenerating(true);

    try {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser) return;

      setMessages((prev) => prev.filter((m) => m.role !== "assistant"));
      setStreamingAssistant("");
      setIsStreaming(true);

      await handleSend(lastUser.content);
    } finally {
      setIsStreaming(false);
      setRegenerating(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-200">
        Loading...
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-200">
        <div className="text-lg font-semibold">Vikini</div>
        <button
          onClick={() => signIn("google")}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 flex overflow-hidden">
      <Sidebar
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={deleteConversation}
        onDeleteAll={deleteAllConversations}
        onRefresh={refreshConversations}
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

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-2 md:px-6 py-6"
        >
          <div className="max-w-3xl mx-auto w-full space-y-4">
            {messages.map((m, idx) => (
              <ChatBubble key={idx} role={m.role} content={m.content} />
            ))}

            {streamingAssistant !== null && (
              <ChatBubble role="assistant" content={streamingAssistant} />
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-neutral-950 border-t border-neutral-800">
          <div className="max-w-3xl mx-auto w-full">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={webSearchEnabled}
                  onClick={toggleWebSearch}
                  className={[
                    "relative inline-flex h-6 w-11 items-center rounded-full border transition",
                    webSearchEnabled
                      ? "bg-neutral-200 border-neutral-200"
                      : "bg-neutral-800 border-neutral-700",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition",
                      webSearchEnabled ? "translate-x-5" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>

                <div className="text-xs text-neutral-300">
                  {language === "vi" ? "Tìm trên web" : "Web search"}
                </div>
              </div>

              <div className="text-xs text-neutral-500">
                {webSearchEnabled
                  ? language === "vi"
                    ? "Bật"
                    : "On"
                  : language === "vi"
                    ? "Tắt"
                    : "Off"}
              </div>
            </div>

            <InputForm
              input={input}
              onChangeInput={setInput}
              onSubmit={() => handleSend()}
              disabled={
                creatingConversation ||
                !input.trim() ||
                isStreaming ||
                regenerating
              }
              t={t}
            />

            <div className="px-4 pb-3 flex items-center justify-between text-xs text-neutral-500">
              <button
                onClick={handleRegenerate}
                disabled={isStreaming || regenerating || messages.length === 0}
                className="hover:text-neutral-300 transition disabled:opacity-50 disabled:hover:text-neutral-500"
              >
                {t.regenerate}
              </button>

              <div className="truncate">
                {session?.user?.email || ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
