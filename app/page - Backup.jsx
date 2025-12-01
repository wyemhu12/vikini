"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

/* =========================
   TRANSLATIONS
========================= */
const translations = {
  vi: {
    appName: "Vikini - Gemini Chat",
    newChat: "Cuộc trò chuyện mới",
    placeholder: "Nhập câu hỏi...",
    send: "Gửi",
    logout: "Đăng xuất",
    thinking: "Đang nghĩ...",
    empty: "Hãy bắt đầu cuộc trò chuyện!",
    whitelist: "Chỉ người được cấp quyền",
    language: "Ngôn ngữ",
    vi: "Tiếng Việt",
    en: "Tiếng Anh",
    themes: "Chủ đề",
    amber: "Cam–Nâu",
    indigo: "Tím–Xanh",
    charcoal: "Xám–Đen",
    systemPrompt: "Chế độ",
    modeDefault: "Mặc định",
    modeDev: "Developer",
    modeFriendly: "Thân thiện",
    modeStrict: "Nghiêm túc",
    renameChat: "Đổi tên cuộc trò chuyện",
    deleteConfirm: "Xóa cuộc trò chuyện này?",
  },
  en: {
    appName: "Vikini - Gemini Chat",
    newChat: "New Chat",
    placeholder: "Type your message...",
    send: "Send",
    logout: "Log out",
    thinking: "Thinking...",
    empty: "Start your conversation!",
    whitelist: "Whitelist only",
    language: "Language",
    vi: "Vietnamese",
    en: "English",
    themes: "Themes",
    amber: "Amber",
    indigo: "Indigo",
    charcoal: "Charcoal",
    systemPrompt: "Mode",
    modeDefault: "Default",
    modeDev: "Developer",
    modeFriendly: "Friendly",
    modeStrict: "Strict",
    renameChat: "Rename conversation",
    deleteConfirm: "Delete this conversation?",
  },
};

/* =========================
   THEME HOOK
========================= */
function useTheme() {
  const [theme, setTheme] = useState("amber");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-theme");
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove(
      "theme-amber",
      "theme-indigo",
      "theme-charcoal"
    );
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem("vikini-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

/* =========================
   LANGUAGE HOOK
========================= */
function useLanguage() {
  const [language, setLanguage] = useState("vi");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-language");
    if (stored) setLanguage(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("vikini-language", language);
  }, [language]);

  return { language, setLanguage };
}

/* =========================
   SYSTEM MODE HOOK
========================= */
function useSystemMode() {
  const [mode, setMode] = useState("default");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-system-mode");
    if (stored) setMode(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("vikini-system-mode", mode);
  }, [mode]);

  return { systemMode: mode, setSystemMode: setMode };
}

/* =========================
   HELPERS
========================= */

function getSystemPrompt(mode, language) {
  const vi = {
    default:
      "Bạn là trợ lý Gemini thân thiện, trả lời ngắn gọn, rõ ràng, ưu tiên tiếng Việt nếu không được yêu cầu ngôn ngữ khác.",
    dev: "Bạn là trợ lý kỹ thuật chuyên về lập trình và hạ tầng. Trả lời chi tiết, có ví dụ code, tập trung vào giải pháp thực tế.",
    friendly:
      "Bạn là trợ lý thân thiện, nói chuyện gần gũi, dễ hiểu, nhưng vẫn chính xác.",
    strict:
      "Bạn là trợ lý nghiêm túc, trả lời trực tiếp, súc tích, không vòng vo, không thêm emoji.",
  };

  const en = {
    default:
      "You are a helpful Gemini assistant. Answer clearly and concisely.",
    dev: "You are a technical assistant focused on coding, infrastructure, and debugging. Provide detailed, practical answers with examples.",
    friendly:
      "You are a friendly assistant. Keep responses warm, casual but still accurate.",
    strict:
      "You are a strict, concise assistant. Answer directly with no fluff and no emojis.",
  };

  const dict = language === "vi" ? vi : en;
  return dict[mode] || dict.default;
}

function createChat(lang) {
  return {
    id: crypto.randomUUID(),
    messages: [], // history phải bắt đầu bằng user cho Gemini 2.5
    createdAt: Date.now(),
    title: lang === "vi" ? "Cuộc trò chuyện mới" : "New chat",
    autoTitled: false,
    renamed: false,
  };
}

/* =========================
   MAIN PAGE
========================= */
export default function HomePage() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { systemMode, setSystemMode } = useSystemMode();
  const t = translations[language];

  const [chats, setChats] = useState([createChat(language)]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [isSending, setSending] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleGeneratingId, setTitleGeneratingId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (!activeId && chats.length > 0) {
      setActiveId(chats[0].id);
    }
  }, [activeId, chats]);

  const activeChat = chats.find((c) => c.id === activeId);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTo({
        top: chatWindowRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeChat?.messages?.length, isSending, regenerating]);

  const newChat = () => {
    const chat = createChat(language);
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
  };

  /* =========================
     AUTO TITLE (AI)
  ========================= */
  useEffect(() => {
    if (!activeChat) return;
    if (activeChat.renamed || activeChat.autoTitled) return;
    if (titleGeneratingId && titleGeneratingId !== activeChat.id) return;

    const hasUser = activeChat.messages.some((m) => m.role === "user");
    const hasAssistant = activeChat.messages.some(
      (m) => m.role === "assistant"
    );
    if (!hasUser || !hasAssistant) return;

    generateTitle(activeChat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, chats, titleGeneratingId]);

  const generateTitle = async (chatId) => {
    setTitleGeneratingId(chatId);
    setTitleLoading(true);

    try {
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return;

      const firstUser = chat.messages.find((m) => m.role === "user");
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
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      let rawTitle = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) rawTitle += decoder.decode(value);
      }

      let title = rawTitle.replace(/\s+/g, " ").trim();
      title = title.replace(/^["“”]+|["“”]+$/g, "");

      // Anti duplicate (ChatGPT style)
      const half = Math.floor(title.length / 2);
      const a = title.slice(0, half).trim();
      const b = title.slice(half).trim();
      if (a && a === b) title = a;

      if (!title) return;
      if (title.length > 60) title = title.slice(0, 57) + "...";

      // Delay nhẹ cho cảm giác "thinking"
      await new Promise((r) => setTimeout(r, 450));

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, title, autoTitled: true } : c
        )
      );
    } catch (err) {
      console.error("title error", err);
    } finally {
      setTitleGeneratingId(null);
      setTitleLoading(false);
    }
  };

  /* =========================
     BUILD HISTORY WITH SYSTEM PROMPT
  ========================= */
  const buildApiHistory = (messages) => {
    const persona = getSystemPrompt(systemMode, language);
    const personaMessage = {
      role: "user",
      content: persona,
    };
    return [personaMessage, ...messages];
  };

  /* =========================
     SEND MESSAGE
  ========================= */
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
      prev.map((c) =>
        c.id === activeChat.id ? { ...c, messages: uiHistory } : c
      )
    );

    setInput("");
    setSending(true);

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
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botStarted = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const text = decoder.decode(value);

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
              msgs[msgs.length - 1].content += text;
              return { ...c, messages: msgs };
            })
          );
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  /* =========================
     REGENERATE RESPONSE
  ========================= */
  const regenerateLast = async () => {
    if (!activeChat || isSending || regenerating) return;
    const msgs = activeChat.messages;
    if (msgs.length === 0) return;

    const lastUserIndex = (() => {
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "user") return i;
      }
      return -1;
    })();

    if (lastUserIndex < 0) return;

    const baseHistory = msgs.slice(0, lastUserIndex + 1); // đến user cuối
    const uiHistory = baseHistory;

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id ? { ...c, messages: uiHistory } : c
      )
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
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let botStarted = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const text = decoder.decode(value);

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
              ms[ms.length - 1].content += text;
              return { ...c, messages: ms };
            })
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  };

  /* =========================
     SIDEBAR ACTIONS
  ========================= */
  const handleRenameChat = (id) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const currentTitle = chat.title;
    const next = window.prompt(
      language === "vi" ? t.renameChat : t.renameChat,
      currentTitle
    );
    if (!next || !next.trim()) return;

    setChats((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: next.trim(), renamed: true } : c
      )
    );
  };

  const handleDeleteChat = (id) => {
    const ok = window.confirm(
      language === "vi" ? t.deleteConfirm : t.deleteConfirm
    );
    if (!ok) return;

    setChats((prev) => prev.filter((c) => c.id !== id));

    if (activeId === id) {
      const remaining = chats.filter((c) => c.id !== id);
      if (remaining.length > 0) setActiveId(remaining[0].id);
      else {
        const chat = createChat(language);
        setChats([chat]);
        setActiveId(chat.id);
      }
    }
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
      {/* SIDEBAR */}
      <aside className="hidden w-64 border-r border-neutral-800 bg-neutral-950 p-3 md:flex md:flex-col">
        <button
          onClick={newChat}
          className="mb-3 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-black text-sm"
        >
          {t.newChat}
        </button>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {chats.map((c) => {
            const isActive = c.id === activeId;
            const isTitleShimmer =
              titleLoading &&
              titleGeneratingId === c.id &&
              !c.autoTitled &&
              !c.renamed;

            return (
              <button
                key={c.id}
                className={`flex w-full items-center justify-between gap-1 rounded-lg px-3 py-2 text-left text-xs ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-900"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <span className="line-clamp-2 flex-1 flex items-center gap-2">
                  {isTitleShimmer ? (
                    <span className="inline-flex h-3 w-24 animate-pulse rounded-full bg-neutral-700/70" />
                  ) : (
                    <span className="transition-opacity duration-300">
                      {c.title}
                    </span>
                  )}

                  {titleLoading && titleGeneratingId === c.id && (
                    <span className="h-3 w-3 animate-spin rounded-full border border-neutral-600 border-t-transparent" />
                  )}
                </span>

                <span className="flex items-center gap-1">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameChat(c.id);
                    }}
                    className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-700"
                  >
                    ✏
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(c.id);
                    }}
                    className="cursor-pointer rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-red-600 hover:text-white"
                  >
                    🗑
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => signOut()}
          className="mt-4 rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:bg-neutral-900"
        >
          {t.logout}
        </button>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex flex-1 flex-col">
        {/* HEADER */}
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-xs">
          <div>
            <div className="font-semibold">{t.appName}</div>
            <div className="text-[11px] text-neutral-400">{t.whitelist}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* LANGUAGE */}
            <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 text-[11px]">
              <button
                onClick={() => setLanguage("vi")}
                className={`px-2 py-1 ${
                  language === "vi"
                    ? "bg-[var(--primary)] text-black"
                    : "text-neutral-300"
                }`}
              >
                VI
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-2 py-1 ${
                  language === "en"
                    ? "bg-[var(--primary)] text-black"
                    : "text-neutral-300"
                }`}
              >
                EN
              </button>
            </div>

            {/* SYSTEM PROMPT SELECTOR */}
            <div className="hidden items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] sm:flex">
              <span className="text-neutral-400">{t.systemPrompt}:</span>
              <select
                className="bg-transparent text-neutral-100 outline-none"
                value={systemMode}
                onChange={(e) => {
                  setSystemMode(e.target.value);
                  setTimeout(() => {
                    if (canRegenerate && activeChat.messages.length > 0) {
                      regenerateLast();
                    }
                  }, 150);
                }}
              >
                <option value="default">{t.modeDefault}</option>
                <option value="dev">{t.modeDev}</option>
                <option value="friendly">{t.modeFriendly}</option>
                <option value="strict">{t.modeStrict}</option>
              </select>
            </div>

            {/* THEME SELECTOR */}
            <div className="flex gap-2">
              {/* Amber */}
              <button
                onClick={() => setTheme("amber")}
                className={`h-4 w-4 rounded-full ${
                  theme === "amber"
                    ? "ring-2 ring-[var(--primary-light)]"
                    : ""
                }`}
                style={{ backgroundColor: "#d97706" }}
              />

              {/* Indigo */}
              <button
                onClick={() => setTheme("indigo")}
                className={`h-4 w-4 rounded-full ${
                  theme === "indigo"
                    ? "ring-2 ring-[var(--primary-light)]"
                    : ""
                }`}
                style={{ backgroundColor: "#6366f1" }}
              />

              {/* Charcoal */}
              <button
                onClick={() => setTheme("charcoal")}
                className={`h-4 w-4 rounded-full ${
                  theme === "charcoal"
                    ? "ring-2 ring-[var(--primary-light)]"
                    : ""
                }`}
                style={{ backgroundColor: "#4b5563" }}
              />
            </div>
          </div>
        </header>

        {/* CHAT CONTENT */}
        <div
          ref={chatWindowRef}
          className="chat-gradient flex-1 overflow-y-auto px-4 py-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col space-y-4 text-sm">
            {/* Greeting (UI only, không vào history) */}
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
                onRegenerate={regenerateLast}
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

        {/* INPUT AREA */}
        <form
          onSubmit={sendMessage}
          className="border-t border-neutral-800 bg-neutral-950 p-3"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              rows={1}
              value={input}
              placeholder={t.placeholder}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-500"
            />

            <button
              type="submit"
              disabled={!input.trim() || isSending || regenerating}
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-black disabled:opacity-40"
            >
              {t.send}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

/* =========================
   CHAT BUBBLE (avatar + toolbar)
========================= */
function ChatBubble({
  message,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  regenerating,
}) {
  const isBot = message.role === "assistant";

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message.content || "").catch(() => {});
    }
  };

  const regenIconClass = regenerating && isLastAssistant
    ? "inline-block animate-spin"
    : "inline-block transition-transform hover:rotate-180";

  return (
    <div
      className={`flex ${
        isBot ? "justify-start" : "justify-end"
      } gap-2 items-end`}
    >
      {isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary-dark)] text-[10px] font-semibold text-[var(--primary-light)]">
          G
        </div>
      )}

      <div className="group relative max-w-[75%]">
        <div
          className={`rounded-xl border px-3 py-2 text-xs ${
            isBot
              ? "border-neutral-800 bg-neutral-900 text-neutral-100"
              : "border-[var(--primary-dark)] bg-[var(--primary)] text-black"
          }`}
        >
          {isBot ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span>{message.content}</span>
          )}
        </div>

        {/* Message toolbar kiểu ChatGPT */}
        <div className="pointer-events-none absolute -top-3 right-1 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md bg-neutral-900/90 px-1.5 py-1 text-[10px] text-neutral-300 shadow-sm ring-1 ring-neutral-700 hover:bg-neutral-800"
          >
            ⧉
          </button>
          {isBot && isLastAssistant && canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-md bg-neutral-900/90 px-1.5 py-1 text-[10px] text-neutral-300 shadow-sm ring-1 ring-neutral-700 hover:bg-neutral-800"
            >
              <span className={regenIconClass}>🔄</span>
            </button>
          )}
        </div>
      </div>

      {!isBot && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-semibold text-neutral-50">
          U
        </div>
      )}
    </div>
  );
}
