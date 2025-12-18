// /app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

import { checkRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

// ✅ New GenAI SDK (supports googleSearch + urlContext tools)
import { GoogleGenAI } from "@google/genai";

function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function sendEvent(controller, event, data) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

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

function safeText(respOrChunk) {
  try {
    if (typeof respOrChunk === "string") return respOrChunk;
    if (respOrChunk?.text) return respOrChunk.text;
    if (respOrChunk?.candidates?.[0]?.content?.parts?.[0]?.text)
      return respOrChunk.candidates[0].content.parts[0].text;
  } catch {}
  return "";
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
      config: { temperature: 0.2 },
    });
    summary = safeText(res).trim();
  } catch {
    summary = "";
  }

  if (summary) {
    await setSummary(conversationId, summary);
  }

  // Keep only last N messages after summarization
  await trimContextToLast(conversationId, CONTEXT_MESSAGE_LIMIT);
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.email.toLowerCase();

    const allowed = checkRateLimit(`chat-stream:${userId}`);
    if (!allowed) {
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

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

    const stream = new ReadableStream({
      async start(controller) {
        if (createdConversation) {
          try {
            sendEvent(controller, "meta", {
              type: "conversationCreated",
              conversation: createdConversation,
            });
          } catch {}
        }

        // ✅ Debug meta: let client see if server *actually* enabled tools
        try {
          sendEvent(controller, "meta", {
            type: "webSearch",
            enabled: enableWebSearch,
            available: WEB_SEARCH_ENABLED,
            cookie: cookieWeb === "1" ? "1" : cookieWeb === "0" ? "0" : "",
          });
        } catch {}

        if (!regenerate) {
          try {
            const optimisticTitle = await generateOptimisticTitle(content);
            if (optimisticTitle) {
              sendEvent(controller, "meta", {
                type: "optimisticTitle",
                conversationId,
                title: optimisticTitle,
              });
            }
          } catch {}
        }

        let full = "";
        let groundingMetadata = null;
        let urlContextMetadata = null;

        try {
          // ✅ @google/genai expects everything in `config`
          const config = {
            systemInstruction: sysPrompt,
            temperature: 0,
            ...(tools.length > 0 ? { tools } : {}),
          };

          const res = await ai.models.generateContentStream({
            model,
            contents,
            config,
          });

          for await (const chunk of res) {
            const t = safeText(chunk);
            if (t) {
              full += t;
              sendEvent(controller, "token", { t });
            }

            try {
              const cand = chunk?.candidates?.[0];
              if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
              if (cand?.urlContextMetadata) urlContextMetadata = cand.urlContextMetadata;
              if (cand?.url_context_metadata) urlContextMetadata = cand.url_context_metadata;
            } catch {}
          }
        } catch (err) {
          console.error("stream error:", err);
          try {
            sendEvent(controller, "error", { message: "Stream error" });
          } catch {}
        }

        try {
          if (groundingMetadata) {
            const chunks = groundingMetadata?.groundingChunks || [];
            const sources = chunks
              .map((c) =>
                c?.web?.uri ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null
              )
              .filter(Boolean);

            sendEvent(controller, "meta", {
              type: "sources",
              sources,
            });
          }
        } catch {}

        try {
          if (urlContextMetadata) {
            const urlMeta =
              urlContextMetadata?.urlMetadata ||
              urlContextMetadata?.url_metadata ||
              [];
            sendEvent(controller, "meta", {
              type: "urlContext",
              urls: urlMeta.map((u) => ({
                retrievedUrl: u.retrievedUrl || u.retrieved_url,
                status: u.urlRetrievalStatus || u.url_retrieval_status,
              })),
            });
          }
        } catch {}

        try {
          const trimmed = full.trim();
          if (trimmed) {
            await appendToContext(conversationId, {
              role: "assistant",
              content: trimmed,
            });

            await saveMessage({
              conversationId,
              userId,
              role: "assistant",
              content: trimmed,
            });

            if (!regenerate) {
              const finalTitle = await generateFinalTitle({
                userId,
                conversationId,
                messages: [...contextMessages, { role: "assistant", content: trimmed }],
              });

              if (finalTitle?.trim()) {
                await setConversationAutoTitle(userId, conversationId, finalTitle.trim());
                sendEvent(controller, "meta", {
                  type: "finalTitle",
                  conversationId,
                  title: finalTitle.trim(),
                });
              }
            }
          }
        } catch (err) {
          console.error("post-stream error:", err);
        }

        try {
          sendEvent(controller, "done", { ok: true });
        } catch {}
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("chat-stream route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
