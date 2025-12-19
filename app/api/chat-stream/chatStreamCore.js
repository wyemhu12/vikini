// /app/api/chat-stream/chatStreamCore.js

import {
  getConversation,
  saveConversation,
  saveMessage,
  deleteLastAssistantMessage,
  setConversationAutoTitle,
  getGemInstructionsForConversation,
} from "@/lib/postgresChat";

import { generateOptimisticTitle, generateFinalTitle } from "@/lib/autoTitleEngine";

import {
  appendToContext,
  removeLastFromContextIfRole,
  toGeminiParts,
  streamGeminiText,
  buildToolDeclarations,
} from "./streaming";

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

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

async function checkpointSummaryIfNeeded(conversationId) {
  // placeholder - keep stable
  return;
}

export async function handleChatStreamCore({ userId, body, req }) {
  const {
    conversationId: conversationIdRaw,
    content,
    systemMode: systemModeRaw,
    language: languageRaw,
  } = body || {};

  const cookies = parseCookieHeader(req?.headers?.get?.("cookie") || "");

  const conversationId = conversationIdRaw || body?.id || null;

  const systemMode =
    systemModeRaw ||
    cookies?.systemMode ||
    process.env.DEFAULT_SYSTEM_MODE ||
    "dev";

  const language =
    languageRaw ||
    cookies?.language ||
    process.env.DEFAULT_LANGUAGE ||
    "vi";

  const maxContextMessages = clamp(
    Number(process.env.MAX_CONTEXT_MESSAGES || 20),
    5,
    200
  );

  const enableWebSearch = envFlag(process.env.ENABLE_WEB_SEARCH, false);
  const enableUrlContext = envFlag(process.env.ENABLE_URL_CONTEXT, false);

  // Create conversation if missing
  let convo = null;
  if (conversationId) {
    convo = await getConversation(conversationId);
  }

  if (!convo) {
    convo = await saveConversation(userId, { title: "New Chat" });
  }

  const id = convo.id;

  // optimistic title update for empty conversations
  try {
    if (!convo.title || convo.title === "New Chat") {
      const optimistic = generateOptimisticTitle(content);
      if (optimistic) {
        await setConversationAutoTitle(userId, id, optimistic);
      }
    }
  } catch {
    // ignore
  }

  // Persist user message
  await saveMessage(userId, id, "user", content || "");

  // --- Build context messages ---
  // We fetch messages in the streaming module; keep API stable
  const context = [];

  // Ensure we checkpoint summary if needed
  try {
    await checkpointSummaryIfNeeded(id);
  } catch {
    // ignore
  }

  // --- Build system instruction ---
  let sysPrompt = "";
  try {
    sysPrompt = await getGemInstructionsForConversation(userId, conversationId);
  } catch {
    sysPrompt = "";
  }

  if (systemMode === "strict") {
    sysPrompt = `${sysPrompt}\n\nBe precise, structured, and avoid speculation.`;
  } else if (systemMode === "friendly") {
    sysPrompt = `${sysPrompt}\n\nBe warm, concise, and helpful.`;
  } else if (systemMode === "dev") {
    sysPrompt = `${sysPrompt}\n\nYou are a helpful assistant.`;
  }

  if (language && language !== "auto") {
    sysPrompt = `${sysPrompt}\n\nReply in ${language}.`;
  }

  // --- Tools ---
  const tools = buildToolDeclarations({
    enableWebSearch,
    enableUrlContext,
  });

  // --- Stream ---
  // Streaming module expects messages as {role, content}; we build minimal
  const parts = toGeminiParts([
    ...(sysPrompt ? [{ role: "system", content: sysPrompt }] : []),
    ...context,
    { role: "user", content: content || "" },
  ]);

  const { stream, onComplete } = await streamGeminiText({
    parts,
    tools,
  });

  // Save assistant message when stream ends
  const finalize = async (finalText) => {
    if (!finalText) return;

    // Best-effort: if assistant message already exists due to retry logic, delete last assistant message
    try {
      await deleteLastAssistantMessage(userId, id);
    } catch {
      // ignore
    }

    await saveMessage(userId, id, "assistant", finalText);

    // Update title after final response
    try {
      const finalTitle = await generateFinalTitle(content || "", finalText);
      if (finalTitle) {
        await setConversationAutoTitle(userId, id, finalTitle);
      }
    } catch {
      // ignore
    }
  };

  onComplete(async (finalText) => {
    try {
      await finalize(finalText);
    } catch (e) {
      console.error("Finalize error:", e);
    }
  });

  return stream;
}
