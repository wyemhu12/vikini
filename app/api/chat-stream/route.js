"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

import { useTheme } from "../../hooks/useTheme";
import { useLanguage } from "../../hooks/useLanguage";
import { useSystemMode } from "../../hooks/useSystemMode";
import { useConversation } from "../../hooks/useConversation";
import { translations } from "../../utils/config";

export default function ChatApp() {
  const { data: session, status } = useSession();
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

  // Assistant đang stream (chưa được lưu Firestore)
  const [streamingAssistant, setStreamingAssistant] = useState(null);

  // UI loading cho title (auto title về sau)
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);

  const chatWindowRef = useRef(null);

  // ----------------------
  // AUTO-SCROLL
  // ----------------------
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, streamingAssistant?.content, isSending, regenerating]);

  // ----------------------
  // KẾT HỢP messages + streamingAssistant
  // ----------------------
  const combinedMessages = useMemo(() => {
    if (streamingAssistant) {
      return [...messages, streamingAssistant];
    }
    return messages;
  }, [messages, streamingAssistant]);

  // ----------------------
  // LAST ASSISTANT INDEX (để hiện Regenerate)
  // ----------------------
  const lastAssistantIndex = useMemo(() => {
    return combinedMessages.reduce(
      (acc, m, idx) => (m.role === "assistant" ? idx : acc),
      -1
    );
  }, [combinedMessages]);

  const canRegenerate = lastAssistantIndex >= 0;

  // ----------------------
  // SEND MESSAGE / REGENERATE
  // ----------------------
  const sendMessage = async (overrideText = null, isRegenerate = false) => {
    const text = (overrideText || input).trim();
    if (!text) return;

    // Bắt buộc phải có conversation trước khi gửi message
    let conversationId = activeId;
    if (!conversationId) {
      const conv = await createConversation(t.newChat || "New chat");
      if (!conv?.id) return;
      conversationId = conv.id;
    }

    // Nếu là message mới => append user message vào UI
    if (!isRegenerate) {
      const tempId = `temp-${Date.now()}`;
      const userMsg = { id: tempId, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
    }

    setInput("");
    setIsSending(!isRegenerate);
    setRegenerating(isRegenerate);
    setStreamingAssistant({ id: "stream", role: "assistant", content: "" });

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

      if (!res.ok || !res.body) {
        throw new Error("Stream error");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        fullText += chunkText;

        setStreamingAssistant((prev) =>
          prev
            ? { ...prev, content: fullText }
            : { id: "stream", role: "assistant", content: fullText }
        );
      }

      // Sau khi stream xong, xoá assistant tạm & sync lại từ Firestore
      setStreamingAssistant(null);
      await loadConversation(conversationId);
    } catch (err) {
      console.error("Chat stream failed:", err);
      setStreamingAssistant(null);
    } finally {
      setIsSending(false);
      setRegenerating(false);
    }
  };

  // REGENERATE LAST ASSISTANT: dùng lại last user message
  const handleRegenerate = () => {
    // Không tính streamingAssistant, chỉ messages thật
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    sendMessage(lastUser.content, true);
  };

  // ----------------------
  // AUTH UI
  // ----------------------
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <button
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-black"
          onClick={() => signIn("google")}
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
          const currentTitle = current?.title || t.newChat || "New chat";
          const newTitle = window.prompt(t.renameChat || "Rename chat", currentTitle);
          if (newTitle && newTitle.trim()) {
            await renameConversation(id, newTitle.trim());
          }
        }}
        onDeleteChat={async (id) => {
          const ok = window.confirm(t.deleteChatConfirm || "Delete this chat?");
          if (!ok) return;
          await deleteConversation(id);
        }}
        onLogout={() => signOut()}
        t={t}
        titleLoading={titleLoading}
        titleGeneratingId={titleGeneratingId}
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
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                {t.loading || "Loading..."}
              </div>
            ) : (
              <div className="flex flex-col space-y-6 text-sm sm:text-base leading-relaxed">
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

          <div className="mx-auto w-full max-w-3xl">
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
