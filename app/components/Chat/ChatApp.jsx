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

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState(null);
  const [streamingSources, setStreamingSources] = useState([]);
  const [streamingUrlContext, setStreamingUrlContext] = useState([]);
  const [regenerating, setRegenerating] = useState(false);

  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [serverWebSearch, setServerWebSearch] = useState(null); // null | boolean
  const [serverWebSearchAvailable, setServerWebSearchAvailable] = useState(null); // null | boolean

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

    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      "path=/",
      "max-age=31536000",
      "samesite=lax",
    ];
    try {
      if (typeof window !== "undefined" && window.location?.protocol === "https:") {
        parts.push("secure");
      }
    } catch {}
    document.cookie = parts.join("; ");
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

      const c = getCookie("vikini_web_search");
      if (c === "1" || c === "0") {
        setWebSearchEnabled(c === "1");
      }
    } catch {}
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

  const scrollRef = useRef(null);

  const normalizeMessages = useCallback((arr) => {
    const safe = Array.isArray(arr) ? arr : [];
    return safe
      .map((m) => ({
        id: m?.id,
        role: m?.role,
        content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
        sources: Array.isArray(m?.sources) ? m.sources : [],
        urlContext: Array.isArray(m?.urlContext) ? m.urlContext : [],
      }))
      .filter((m) => m.role === "user" || m.role === "assistant");
  }, []);

  const renderedMessages = useMemo(
    () => normalizeMessages(messages),
    [messages, normalizeMessages]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [renderedMessages, streamingAssistant]);

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
      const res = await fetch(`/api/conversations?id=${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");
      const data = await res.json();
      setMessages(normalizeMessages(data?.messages));
    } catch (e) {
      console.error(e);
      setMessages([]);
    }
  };

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
          setMessages([]);
          setStreamingAssistant(null);
          setInput("");
        }

        // Best-effort revalidate
        await refreshConversations();
      } catch (e) {
        console.error(e);
        alert("Không xoá được. Vui lòng thử lại.");
      }
    },
    [deleteConversation, refreshConversations, selectedConversationId]
  );

  const streamingAssistantRef = useRef(streamingAssistant);
  useEffect(() => {
    streamingAssistantRef.current = streamingAssistant;
  }, [streamingAssistant]);

  const handleSend = async (overrideText, options = {}) => {
    if (!isAuthed) return;
    if (creatingConversation) return;

    const text = (overrideText ?? input).trim();
    if (!text) return;

    const regenerate = Boolean(options?.regenerate);
    const skipUserAppend = Boolean(options?.skipUserAppend);

    setInput("");
    setIsStreaming(true);
    setStreamingAssistant("");
    setStreamingSources([]);
    setStreamingUrlContext([]);

    if (!skipUserAppend) {
      const userMsg = { role: "user", content: text };
      setMessages((prev) => [...normalizeMessages(prev), userMsg]);
    }

    let convId = selectedConversationId;

    if (!convId) {
      setCreatingConversation(true);
      try {
        const conv = await createConversation();
        convId = conv?.id;
        if (convId) setSelectedConversationId(convId);
      } finally {
        setCreatingConversation(false);
      }
    }

    try {
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          conversationId: convId,
          content: text,
          regenerate,
          systemMode,
          language,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let localSources = [];
      let localUrlContext = [];

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
            const tok = data?.t || "";
            if (tok) setStreamingAssistant((prev) => (prev || "") + tok);
          }

          if (event === "meta") {
            if (data?.type === "conversationCreated" && data?.conversation?.id) {
              setSelectedConversationId(data.conversation.id);
              await refreshConversations();
            }

            if (data?.type === "optimisticTitle" && data?.title) {
              renameConversationOptimistic(data.conversationId, data.title || "New Chat");
            }

            if (data?.type === "finalTitle" && data?.title) {
              renameConversationFinal(data.conversationId, data.title || "New Chat");
            }

            if (data?.type === "sources") {
              const nextSources = Array.isArray(data?.sources) ? data.sources : [];
              localSources = nextSources;
              setStreamingSources(nextSources);
            }

            if (data?.type === "urlContext") {
              const nextUrls = Array.isArray(data?.urls) ? data.urls : [];
              localUrlContext = nextUrls;
              setStreamingUrlContext(nextUrls);
            }

            if (data?.type === "webSearch") {
              if (typeof data?.enabled === "boolean") setServerWebSearch(data.enabled);
              if (typeof data?.available === "boolean") setServerWebSearchAvailable(data.available);
            }
          }
        }
      }

      const finalAssistant = streamingAssistantRef.current || "";
      const assistantMsg = {
        role: "assistant",
        content: finalAssistant,
        sources: Array.isArray(localSources) ? localSources : [],
        urlContext: Array.isArray(localUrlContext) ? localUrlContext : [],
      };

      setMessages((prev) => [...normalizeMessages(prev), assistantMsg]);
      setStreamingAssistant(null);
      setStreamingSources([]);
      setStreamingUrlContext([]);
    } catch (e) {
      console.error(e);
      setStreamingAssistant(null);
      setStreamingSources([]);
      setStreamingUrlContext([]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedConversationId) return;
    if (isStreaming) return;

    setRegenerating(true);

    try {
      const safe = normalizeMessages(messages);
      const lastUser = [...safe].reverse().find((m) => m.role === "user");
      if (!lastUser?.content) return;

      setMessages((prev) => {
        const arr = normalizeMessages(prev);
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i]?.role === "assistant") {
            return [...arr.slice(0, i), ...arr.slice(i + 1)];
          }
        }
        return arr;
      });

      await handleSend(lastUser.content, { regenerate: true, skipUserAppend: true });
    } finally {
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

  const serverHint =
    serverWebSearchAvailable === false
      ? " (server: feature OFF)"
      : serverWebSearch === false && webSearchEnabled
      ? " (server: OFF)"
      : "";

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
