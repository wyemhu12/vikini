// /app/api/chat-stream/chatStreamCore.js

import { GoogleGenAI } from "@google/genai";

import {
  getConversation,
  saveConversation,
  saveMessage,
  deleteLastAssistantMessage,
  setConversationAutoTitle,
  getGemInstructionsForConversation,
} from "@/lib/postgresChat";

import { generateOptimisticTitle, generateFinalTitle } from "@/lib/autoTitleEngine";

import { createChatReadableStream } from "./streaming";

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};
  const out = {};
  const parts = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    out[k] = decodeURIComponent(v || "");
  }
  return out;
}

function envFlag(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function handleChatStreamCore({ req, userId }) {
  // route.js không truyền body vào; phải tự đọc req.json()
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const {
    conversationId: conversationIdRaw,
    content,
    regenerate,
  } = body || {};

  if (typeof content !== "string" || !content.trim()) {
    return jsonError("Missing content", 400);
  }

  const cookies = parseCookieHeader(req?.headers?.get?.("cookie") || "");

  // Flags (giữ tương thích với streaming.js meta)
  const WEB_SEARCH_ENABLED = envFlag(process.env.ENABLE_WEB_SEARCH, false);
  const URL_CONTEXT_ENABLED = envFlag(process.env.ENABLE_URL_CONTEXT, false);

  // Cookie override (nếu có). Nếu cookie không tồn tại -> dùng env.
  const cookieWeb = cookies?.webSearchEnabled ?? cookies?.webSearch ?? "";
  const cookieUrl = cookies?.urlContextEnabled ?? cookies?.urlContext ?? "";

  const enableWebSearch =
    cookieWeb === "1" ? true : cookieWeb === "0" ? false : WEB_SEARCH_ENABLED;

  const enableUrlContext =
    cookieUrl === "1" ? true : cookieUrl === "0" ? false : URL_CONTEXT_ENABLED;

  // Khởi tạo ai client (@google/genai)
  const apiKey = pickFirstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"]);
  if (!apiKey) return jsonError("Missing GEMINI_API_KEY/GOOGLE_API_KEY", 500);

  const ai = new GoogleGenAI({ apiKey });

  const model =
    pickFirstEnv(["GEMINI_MODEL", "GOOGLE_MODEL"]) || "gemini-2.0-flash";

  // Load / create conversation
  let convo = null;
  const requestedConversationId = conversationIdRaw || null;

  if (requestedConversationId) {
    try {
      convo = await getConversation(requestedConversationId);
    } catch {
      convo = null;
    }
  }

  let createdConversation = null;
  if (!convo) {
    // Tạo conversation mới
    try {
      convo = await saveConversation(userId, { title: "New Chat" });
      createdConversation = convo;
    } catch (e) {
      return jsonError(e?.message || "Failed to create conversation", 500);
    }
  }

  const conversationId = convo?.id;
  if (!conversationId) return jsonError("Conversation missing id", 500);

  // Nếu regenerate: xoá last assistant message (best-effort)
  if (regenerate) {
    try {
      await deleteLastAssistantMessage(userId, conversationId);
    } catch {
      // ignore
    }
  }

  // Lưu user message
  try {
    await saveMessage(userId, conversationId, "user", content);
  } catch (e) {
    return jsonError(e?.message || "Failed to save user message", 500);
  }

  // GEM sysPrompt theo conversation
  let sysPrompt = "";
  try {
    sysPrompt = await getGemInstructionsForConversation(userId, conversationId);
  } catch {
    sysPrompt = "";
  }

  // Tools: để an toàn compile + tránh sai schema tool declaration, mặc định để []
  // (Nếu bạn muốn bật web search/url context bằng tool chính thức của SDK, mình sẽ bổ sung sau khi sync đúng phiên bản SDK bạn đang dùng.)
  const tools = [];

  // Build contents theo @google/genai: [{role, parts:[{text}]}]
  // Ở bản vá tối thiểu này, không kéo full history để tránh phụ thuộc thêm exports khác.
  const contextMessages = [];
  const contents = [
    { role: "user", parts: [{ text: content }] },
  ];

  // Wrapper theo signature mà streaming.js đang gọi: saveMessage({conversationId,userId,role,content})
  const saveMessageCompat = async ({ conversationId, userId, role, content }) => {
    return saveMessage(userId, conversationId, role, content);
  };

  const stream = createChatReadableStream({
    ai,
    model,
    contents,
    sysPrompt,
    tools,

    createdConversation,
    enableWebSearch,
    WEB_SEARCH_ENABLED,
    cookieWeb,

    regenerate: Boolean(regenerate),
    content,
    conversationId,
    userId,
    contextMessages,

    // streaming.js yêu cầu các callback này; dùng no-op cho context tại bản vá tối thiểu
    appendToContext: async () => {},
    saveMessage: saveMessageCompat,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
