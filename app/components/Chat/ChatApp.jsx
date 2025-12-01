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
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const chatWindowRef = useRef(null);
  const chatsRef = useRef(chats);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats, chatsRef]);

  // Ensure activeId is set
  useEffect(() => {
    if (!activeId && chats.length > 0) {
      setActiveId(chats[0].id);
    }
  }, [activeId, chats]);

  const activeChat = chats.find((c) => c.id === activeId) || null;

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeChat?.messages?.length, isSending, regenerating]);

  // Load conversations from Firestore for this user
  useEffect(() => {
    const load = async () => {
      if (!session?.user?.email) {
        setLoadingConversations(false);
        return;
      }
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to load conversations");
        const data = await res.json();
        if (Array.isArray(data.conversations) && data.conversations.length > 0) {
          setChats(data.conversations);
          setActiveId(data.conversations[0].id);
        } else {
          const chat = createChat(language);
          setChats([chat]);
          setActiveId(chat.id);
        }
      } catch (err) {
        console.error("load conversations failed", err);
        const chat = createChat(language);
        setChats([chat]);
        setActiveId(chat.id);
      } finally {
        setLoadingConversations(false);
      }
    };

    if (status === "authenticated") {
      load();
    }
  }, [status, session?.user?.email, language]);

  const persistConversation = async (chat) => {
    try {
      await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat: {
            ...chat,
            systemMode,
            language,
          },
        }),
      });
    } catch (err) {
      console.error("save conversation failed", err);
    }
  };

  const deleteConversationOnServer = async (id) => {
    try {
      await fetch("/api/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("delete conversation failed", err);
    }
  };

  const buildApiHistory = (messages) => {
    const persona = getSystemPrompt(systemMode, language);
    const personaMessage = {
      role: "user",
      content: persona,
    };
    return [personaMessage, ...messages];
  };

  const newChat = () => {
    const chat = createChat(language);
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    persistConversation(chat);
  };

  // Auto-generate title once conversation has both user + assistant msg
  useEffect(() => {
    if (!activeChat) return;
    if (activeChat.renamed || activeChat.autoTitled) return;
    if (titleGeneratingId && titleGeneratingId !== activeChat.id) return;

    const hasUser = activeChat.messages.some((m) => m.role === "user");
    const hasAssistant = activeChat.messages.some((m) => m.role === "assistant");
    if (!hasUser || !hasAssistant) return;

    const generateTitle = async () => {
      setTitleGeneratingId(activeChat.id);
      setTitleLoading(true);

      try {
        const firstUser = activeChat.messages.find((m) => m.role === "user");
        if (!firstUser) return;

        const promptText =
          language === "vi"
            ? "Tạo tiêu đề rất ngắn (tối đa 6 từ) mô tả chủ đề chính của cuộc trò chuyện này. Chỉ trả về tiêu đề."
            : "Create a very short title (max 6 words) describing this conversation. Return only the title.";

        const response = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `${promptText}\n\n${firstUser.content}`,
              },
            ],
            chatId: activeChat.id,
            metadata: {
              titleOnly: true,
            },
          }),
        });

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let done = false;
        let rawTitle = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            rawTitle += decoder.decode(value, { stream: !done });
          }
        }

        let title = rawTitle.replace(/\s+/g, " ").trim();
        title = title.replace(/^[\"“”]+|[\"“”]+$/g, "");

        const half = Math.floor(title.length / 2);
        const a = title.slice(0, half).trim();
        const b = title.slice(half).trim();
        if (a && a === b) title = a;

        if (!title) return;
        if (title.length > 60) title = title.slice(0, 57) + "...";

        await new Promise((r) => setTimeout(r, 450));

        let updatedChat = null;

        setChats((prev) =>
          prev.map((c) => {
            if (c.id === activeChat.id) {
              updatedChat = {
                ...c,
                title,
                autoTitled: true,
              };
              return updatedChat;
            }
            return c;
          })
        );

        if (updatedChat) {
          persistConversation(updatedChat);
        }
      } catch (err) {
        console.error("title error", err);
      } finally {
        setTitleGeneratingId(null);
        setTitleLoading(false);
      }
    };

    generateTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, chats, titleGeneratingId, language, systemMode]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !activeChat || isSending || regenerating) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const uiHistory = [...activeChat.messages, userMessage];
    const sendHistory = [...activeChat.messages, userMessage];

    setChats((prev) =>
      prev.map((c) => (c.id === activeChat.id ? { ...c, messages: uiHistory } : c))
    );

    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildApiHistory(
            sendHistory.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          ),
          chatId: activeChat.id,
          metadata: {
            systemMode,
            language,
            title: activeChat.title,
          },
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botStarted = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;
        const text = decoder.decode(value, { stream: !done });

        if (!botStarted) {
          botStarted = true;
          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== activeChat.id) return c;
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: text,
                  },
                ],
              };
            })
          );
          continue;
        }

        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== activeChat.id) return c;
            const msgs = [...c.messages];
            const lastIndex = msgs.length - 1;
            msgs[lastIndex] = {
              ...msgs[lastIndex],
              content: (msgs[lastIndex].content || "") + text,
            };
            return { ...c, messages: msgs };
          })
        );
      }

      // After stream ended, persist latest version of this chat
      const latest = chatsRef.current.find((c) => c.id === activeChat.id);
      if (latest) {
        persistConversation(latest);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const regenerateLast = async () => {
    if (!activeChat || isSending || regenerating) return;
    const msgs = activeChat.messages;
    if (!msgs.length) return;

    let lastUserIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex < 0) return;

    const baseHistory = msgs.slice(0, lastUserIndex + 1);

    const uiHistory = baseHistory;

    setChats((prev) =>
      prev.map((c) => (c.id === activeChat.id ? { ...c, messages: uiHistory } : c))
    );

    setRegenerating(true);

    try {
      const response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: buildApiHistory(
            baseHistory.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          ),
          chatId: activeChat.id,
          metadata: {
            systemMode,
            language,
            title: activeChat.title,
          },
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botStarted = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (!value) continue;
        const text = decoder.decode(value, { stream: !done });

        if (!botStarted) {
          botStarted = true;
          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== activeChat.id) return c;
              return {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: text,
                  },
                ],
              };
            })
          );
          continue;
        }

        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== activeChat.id) return c;
            const ms = [...c.messages];
            const lastIndex = ms.length - 1;
            ms[lastIndex] = {
              ...ms[lastIndex],
              content: (ms[lastIndex].content || "") + text,
            };
            return { ...c, messages: ms };
          })
        );
      }

      const latest = chatsRef.current.find((c) => c.id === activeChat.id);
      if (latest) {
        persistConversation(latest);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRenameChat = (id) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const currentTitle = chat.title;
    const next = window.prompt(t.renameChat, currentTitle);
    if (!next || !next.trim()) return;

    const updatedTitle = next.trim();

    let updatedChat = null;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          updatedChat = { ...c, title: updatedTitle, renamed: true };
          return updatedChat;
        }
        return c;
      })
    );

    if (updatedChat) {
      persistConversation(updatedChat);
    }
  };

  const handleDeleteChat = (id) => {
    const ok = window.confirm(t.deleteConfirm);
    if (!ok) return;

    setChats((prev) => prev.filter((c) => c.id !== id));
    deleteConversationOnServer(id);

    if (activeId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        const chat = createChat(language);
        setChats([chat]);
        setActiveId(chat.id);
        persistConversation(chat);
      }
    }
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
  };

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme);
  };

  const handleSystemModeChange = (mode) => {
    setSystemMode(mode);
    // Re-generate answer immediately after changing persona, if possible
    setTimeout(() => {
      if (activeChat && activeChat.messages.length > 0) {
        regenerateLast();
      }
    }, 150);
  };

  const handleLogout = () => {
    signOut();
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!session) {
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
  }

  if (!activeChat) {
    return (
      <div className="flex h-screen items-center justify-center">
        <button
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-black"
          onClick={newChat}
        >
          {t.newChat}
        </button>
      </div>
    );
  }

  const lastAssistantIndex = (() => {
    if (!activeChat) return -1;
    let idx = -1;
    activeChat.messages.forEach((m, i) => {
      if (m.role === "assistant") idx = i;
    });
    return idx;
  })();

  const canRegenerate = lastAssistantIndex >= 0;

  return (
    <div className="flex h-screen">
      <Sidebar
        chats={chats}
        activeId={activeId}
        onNewChat={newChat}
        onSelectChat={setActiveId}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onLogout={handleLogout}
        t={t}
        titleLoading={titleLoading}
        titleGeneratingId={titleGeneratingId}
      />

      <main className="flex flex-1 flex-col">
        <HeaderBar
          t={t}
          language={language}
          onLanguageChange={handleLanguageChange}
          systemMode={systemMode}
          onSystemModeChange={handleSystemModeChange}
          theme={theme}
          onThemeChange={handleThemeChange}
        />

        <div
          ref={chatWindowRef}
          className="chat-gradient flex-1 overflow-y-auto px-4 py-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col space-y-4 text-sm">
            {activeChat.messages.length === 0 && (
              <ChatBubble
                message={{
                  role: "assistant",
                  content:
                    language === "vi"
                      ? "Xin chào! Mình là bot Gemini. Hãy hỏi mình bất cứ điều gì 😊"
                      : "Hello! I'm Gemini. Ask me anything 😊",
                }}
                isLastAssistant={false}
                canRegenerate={false}
                onRegenerate={() => {}}
                regenerating={false}
              />
            )}

            {activeChat.messages.map((msg, index) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isLastAssistant={
                  msg.role === "assistant" && index === lastAssistantIndex
                }
                canRegenerate={canRegenerate}
                onRegenerate={regenerating ? () => {} : regenerateLast}
                regenerating={regenerating}
              />
            ))}

            {(isSending || regenerating) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs text-neutral-300">
                  <span>{t.thinking}</span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500 [animation-delay:0.3s]" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <InputForm
          input={input}
          onChangeInput={setInput}
          onSubmit={sendMessage}
          disabled={!input.trim() || isSending || regenerating}
          t={t}
        />
      </main>
    </div>
  );
}
