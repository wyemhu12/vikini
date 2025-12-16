// /app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getConversation,
  saveConversation,
  saveMessage,
  setConversationAutoTitle,
  getGemInstructionsForUser,
} from "@/lib/postgresChat";

import {
  generateOptimisticTitle,
  generateFinalTitle,
} from "@/lib/autoTitleEngine";

import {
  appendToContext,
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

const encoder = new TextEncoder();

/**
 * SSE helper
 * - event: token | meta | error | done
 * - data: JSON object
 */
function sendEvent(controller, event, data) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  const parts = header.split(";").map((p) => p.trim()).filter(Boolean);
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
  if (!respOrChunk) return "";
  try {
    if (typeof respOrChunk.text === "function") return respOrChunk.text() || "";
    if (typeof respOrChunk.text === "string") return respOrChunk.text || "";
  } catch {
    // ignore
  }
  // Fallback: dig into candidates/parts if present
  const parts = respOrChunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p) => p?.text || "").join("");
  }
  return "";
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_ID = "gemini-2.5-flash";

const WEB_SEARCH_ENABLED = envFlag(process.env.WEB_SEARCH_ENABLED, false);
const URL_CONTEXT_ENABLED = envFlag(process.env.URL_CONTEXT_ENABLED, true);

async function checkpointSummaryIfNeeded(conversationId) {
  try {
    const currentLen = await getContextLength(conversationId);
    if (currentLen <= CONTEXT_MESSAGE_LIMIT) return;

    const overflow = await getOverflowForSummary(
      conversationId,
      CONTEXT_MESSAGE_LIMIT
    );
    if (!overflow || overflow.length === 0) return;

    const existingSummary = (await getSummary(conversationId)) || "";
    const overflowText = overflow
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n")
      .slice(0, 8000);

    const summaryPrompt = existingSummary
      ? `You are a concise summarizer.\n\nExisting running summary:\n${existingSummary}\n\nNew transcript chunk:\n${overflowText}\n\nCreate an updated running summary. Keep it short, factual, and preserve key decisions and user preferences.`
      : `You are a concise summarizer.\n\nTranscript:\n${overflowText}\n\nCreate a running summary. Keep it short, factual, and preserve key decisions and user preferences.`;

    const res = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
      config: { temperature: 0.2, maxOutputTokens: 512 },
    });

    const newSummary = (safeText(res) || "").trim();
    if (!newSummary) return;

    await setSummary(conversationId, newSummary);

    // Only trim after summary success to avoid losing history without a checkpoint.
    await trimContextToLast(conversationId, CONTEXT_MESSAGE_LIMIT);
  } catch (e) {
    // If summary fails, do not trim (buffer is still hard-capped in redisContext)
    console.error("checkpointSummaryIfNeeded error:", e);
  }
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
      systemMode = "default",
      language = "vi",
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    if (language !== "vi" && language !== "en") language = "vi";

    // ===============================
    // Web Search / URL Context toggles
    // - UI sets cookie: vikini_web_search=1|0
    // - Server also has feature-gates via ENV:
    //   WEB_SEARCH_ENABLED=true|false
    //   URL_CONTEXT_ENABLED=true|false
    // ===============================
    const cookies = parseCookies(req.headers.get("cookie") || "");
    const enableWebSearch =
      WEB_SEARCH_ENABLED && cookies["vikini_web_search"] === "1";

    const enableUrlContext = URL_CONTEXT_ENABLED && hasUrl(content);

    // Create conversation if needed
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

    // --- Redis: append USER message ---
    await appendToContext(conversationId, {
      role: "user",
      content,
    });

    // --- DB: persist USER message ---
    await saveMessage({
      conversationId,
      userId,
      role: "user",
      content,
    });

    // Try summarize if overflow
    await checkpointSummaryIfNeeded(conversationId);

    // Load context for request
    const contextMessages = await getContext(conversationId);
    const runningSummary = (await getSummary(conversationId)) || "";

    const baseSysPrompt = `You are Vikini. Respond helpfully.\n\nSystem mode: ${systemMode}\nLanguage: ${language}`;
    let gemInstructions = null;

    if (convo?.gemId) {
      try {
        gemInstructions = await getGemInstructionsForUser(userId, convo.gemId);
      } catch (e) {
        console.error("Gem instructions load error:", e);
        gemInstructions = null;
      }
    }

    let sysPrompt = baseSysPrompt;

    if (gemInstructions?.trim()) {
      sysPrompt = `${sysPrompt}\n\n[Gem Instructions]\n${gemInstructions.trim()}`;
    }

    if (runningSummary) {
      sysPrompt = `${sysPrompt}\n\n[Conversation summary for context]\n${runningSummary}`;
    }

    const tools = [];
    if (enableWebSearch) tools.push({ googleSearch: {} });
    if (enableUrlContext) tools.push({ urlContext: {} });

    const stream = new ReadableStream({
      async start(controller) {
        // 1) META: conversation created
        if (createdConversation) {
          try {
            sendEvent(controller, "meta", {
              type: "conversationCreated",
              conversation: createdConversation,
            });
          } catch {}
        }

        try {
          sendEvent(controller, "meta", {
            type: "webSearch",
            enabled: enableWebSearch,
          });
        } catch {}

        // 2) OPTIMISTIC TITLE
        try {
          const optimisticTitle = await generateOptimisticTitle({
            userId,
            conversationId,
            messages: contextMessages,
          });
          if (optimisticTitle) {
            sendEvent(controller, "meta", {
              type: "optimisticTitle",
              conversationId,
              title: optimisticTitle,
            });
          }
        } catch {}

        // 3) STREAM
        let full = "";
        let groundingMetadata = null;
        let urlContextMetadata = null;

        try {
          const config = {
            systemInstruction: sysPrompt,
            temperature: 0.85,
            topP: 0.9,
            maxOutputTokens: 4096,
            ...(tools.length ? { tools } : {}),
          };

          const result = await ai.models.generateContentStream({
            model: MODEL_ID,
            contents: mapMessages(contextMessages),
            config,
          });

          for await (const chunk of result) {
            let text = "";
            try {
              text = safeText(chunk) || "";
            } catch {
              continue;
            }

            if (!text) continue;

            full += text;
            sendEvent(controller, "token", { t: text });
            const cand = chunk?.candidates?.[0];
            if (cand?.groundingMetadata) groundingMetadata = cand.groundingMetadata;
            if (cand?.urlContextMetadata) urlContextMetadata = cand.urlContextMetadata;
            if (cand?.url_context_metadata) urlContextMetadata = cand.url_context_metadata;
          }
        } catch (err) {
          console.error("stream error:", err);
          try {
            sendEvent(controller, "error", { message: "Stream error" });
          } catch {}
        }

        // Optional: expose tool metadata so the client can render citations / debug
        try {
          if (groundingMetadata) {
            const chunks = groundingMetadata?.groundingChunks || [];
            const sources = chunks
              .map((c) =>
                c?.web?.uri
                  ? { uri: c.web.uri, title: c.web.title || c.web.uri }
                  : null
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

        // 4) POST STREAM
        try {
          const trimmed = full.trim();
          if (trimmed) {
            // Redis append ASSISTANT
            await appendToContext(conversationId, {
              role: "assistant",
              content: trimmed,
            });

            // DB persist ASSISTANT
            await saveMessage({
              conversationId,
              userId,
              role: "assistant",
              content: trimmed,
            });

            // FINAL TITLE
            const finalTitle = await generateFinalTitle({
              userId,
              conversationId,
              messages: [
                ...contextMessages,
                { role: "assistant", content: trimmed },
              ],
            });

            if (finalTitle?.trim()) {
              await setConversationAutoTitle(conversationId, finalTitle.trim());
              sendEvent(controller, "meta", {
                type: "finalTitle",
                conversationId,
                title: finalTitle.trim(),
              });
            }
          }
        } catch (err) {
          console.error("post-stream error:", err);
        }

        // 5) DONE
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
