// /app/api/chat-stream/chatStreamCore.js

import {
  getConversation,
  saveConversation,
  saveMessage,
  deleteLastAssistantMessage,
  setConversationAutoTitle,
  getGemInstructionsForUser,
} from "@/lib/postgresChat";

import { generateOptimisticTitle, generateFinalTitle } from "@/lib/autoTitleEngine";

import {
  appendToContext,
  removeLastFromContextIfRole,
  getContext,
  getContextLength,
  getOverflowForSummary,
  trimContextToLast,
  getSummary,
  setSummary,
  CONTEXT_MESSAGE_LIMIT,
} from "@/lib/redisContext";

// ✅ New GenAI SDK (supports googleSearch + urlContext tools)
import { GoogleGenAI } from "@google/genai";

import { createChatReadableStream, mapMessages } from "./streaming";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = header
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
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function hasUrl(text) {
  return /https?:\/\/\S+/i.test(text || "");
}

async function checkpointSummaryIfNeeded(conversationId) {
  const len = await getContextLength(conversationId);
  if (len <= CONTEXT_MESSAGE_LIMIT) return;

  const overflow = await getOverflowForSummary(conversationId, CONTEXT_MESSAGE_LIMIT);
  if (!overflow || overflow.length === 0) return;

  const existingSummary = (await getSummary(conversationId)) || "";
  const overflowText = overflow
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")
    .slice(0, 8000);

  const summaryPrompt = existingSummary
    ? `You are a concise summarizer.\n\nExisting running summary:\n${existingSummary}\n\nNew transcript chunk:\n${overflowText}\n\nCreate an updated running summary. Keep it short, factual, and useful for future context.`
    : `You are a concise summarizer.\n\nTranscript chunk:\n${overflowText}\n\nCreate a running summary. Keep it short, factual, and useful for future context.`;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  let summary = "";
  try {
    // ✅ @google/genai uses `config` (not generationConfig)
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
      config: { temperature: 0 },
    });

    // res.text is supported in some wrappers, but we keep safe access patterns minimal here
    summary = res?.text || res?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e) {
    console.error("summary error:", e);
  }

  if (summary?.trim()) {
    await setSummary(conversationId, summary);
  }

  // Keep only last N messages after summarization
  await trimContextToLast(conversationId, CONTEXT_MESSAGE_LIMIT);
}

export async function handleChatStreamCore({ req, userId }) {
  const body = await req.json();
  let {
    conversationId,
    content,
    regenerate = false,
    systemMode = "default",
    language = "vi",
  } = body || {};

  if (!content?.trim()) {
    return new Response("Empty content", { status: 400 });
  }

  if (regenerate && !conversationId) {
    return new Response("Missing conversationId for regenerate", { status: 400 });
  }

  if (language !== "vi" && language !== "en") language = "vi";

  // ===============================
  // Web Search / URL Context toggles
  // - UI sets cookie: vikini_web_search=1/0
  // ===============================
  const WEB_SEARCH_ENABLED = envFlag(process.env.WEB_SEARCH_ENABLED, false);
  const URL_CONTEXT_ENABLED = envFlag(process.env.URL_CONTEXT_ENABLED, false);

  const cookies = parseCookies(req.headers.get("cookie") || "");
  const cookieWeb = cookies["vikini_web_search"];

  const enableWebSearch = WEB_SEARCH_ENABLED && cookieWeb === "1";
  const enableUrlContext = URL_CONTEXT_ENABLED && hasUrl(content);

  // Ensure conversation exists
  let createdConversation = null;
  if (!conversationId) {
    const conv = await saveConversation(userId, {
      title: "New Chat",
      createdAt: Date.now(),
    });
    conversationId = conv.id;
    createdConversation = conv;
  }

  const convo = await getConversation(conversationId);
  if (!convo || convo.userId !== userId) {
    return new Response("Conversation not found", { status: 404 });
  }

  if (regenerate) {
    try {
      await removeLastFromContextIfRole(conversationId, "assistant");
    } catch {}

    try {
      await deleteLastAssistantMessage(userId, conversationId);
    } catch {}
  } else {
    await appendToContext(conversationId, {
      role: "user",
      content,
    });

    await saveMessage({
      conversationId,
      userId,
      role: "user",
      content,
    });

    await checkpointSummaryIfNeeded(conversationId);
  }

  // --- Build system instruction ---
  let sysPrompt = "";
  try {
    sysPrompt = await getGemInstructionsForUser(userId);
  } catch {
    sysPrompt = "";
  }

  if (systemMode === "strict") {
    sysPrompt = `${sysPrompt}\n\nBe precise, structured, and avoid speculation.`;
  } else if (systemMode === "friendly") {
    sysPrompt = `${sysPrompt}\n\nBe friendly and helpful.`;
  }

  if (language === "en") {
    sysPrompt = `${sysPrompt}\n\nRespond in English.`;
  } else {
    sysPrompt = `${sysPrompt}\n\nTrả lời bằng tiếng Việt.`;
  }

  const runningSummary = (await getSummary(conversationId)) || "";
  if (runningSummary?.trim()) {
    sysPrompt = `${sysPrompt}\n\n[Conversation summary for context]\n${runningSummary}`;
  }

  const tools = [];
  if (enableWebSearch) tools.push({ googleSearch: {} });
  if (enableUrlContext) tools.push({ urlContext: {} });

  const contextMessages = await getContext(conversationId, CONTEXT_MESSAGE_LIMIT);
  const contents = mapMessages(contextMessages);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const stream = createChatReadableStream({
    ai,
    model,
    contents,
    sysPrompt,
    tools,

    // meta / toggles
    createdConversation,
    enableWebSearch,
    enableUrlContext,
    WEB_SEARCH_ENABLED,
    cookieWeb,

    // request context
    regenerate,
    content,
    conversationId,
    userId,
    contextMessages,

    // deps for post-processing
    appendToContext,
    saveMessage,
    setConversationAutoTitle,
    generateOptimisticTitle,
    generateFinalTitle,
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
