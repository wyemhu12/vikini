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
  appendToContext,
  getContext,
  getContextLength,
  getOverflowForSummary,
  trimContextToLast,
  getSummary,
  setSummary,
  CONTEXT_MESSAGE_LIMIT,
} from "@/lib/redisContext";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import {
  generateOptimisticTitle,
  generateFinalTitle,
} from "@/lib/autoTitleEngine";

import { checkRateLimit } from "@/lib/rateLimit";

// Map messages → Gemini format
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

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

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
      ? `You are a concise summarizer.\n\nExisting running summary:\n${existingSummary}\n\nNew transcript to incorporate:\n${overflowText}\n\nUpdate the running summary. Keep it short, factual, and preserve key decisions and user preferences.`
      : `You are a concise summarizer.\n\nTranscript:\n${overflowText}\n\nCreate a running summary. Keep it short, factual, and preserve key decisions and user preferences.`;

    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });

    const newSummary = (res?.response?.text?.() || "").trim();
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
          "Retry-After": "60",
        },
      });
    }

    const body = await req.json();

    // ✅ Only accept: conversationId + content
    let { conversationId, content } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

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

    // checkpoint summary if needed BEFORE generating the model response (so we don't blow context)
    await checkpointSummaryIfNeeded(conversationId);

    // --- Load short-term context (last N turns) ---
    let contextMessages = await getContext(conversationId, CONTEXT_MESSAGE_LIMIT);

    // Gemini requires non-empty contents
    if (!contextMessages || contextMessages.length === 0) {
      contextMessages = [{ role: "user", content }];
    }

    // ✅ Only load GEM instructions (if conversation has gem_id)
    let gemInstructions = null;
    if (convo?.gemId) {
      try {
        gemInstructions = await getGemInstructionsForUser(userId, convo.gemId);
      } catch (e) {
        console.error("Gem instructions load error:", e);
        gemInstructions = null;
      }
    }

    // ✅ System instruction is GEM only (no mode/language, no runningSummary)
    const sysPrompt = (gemInstructions || "").trim();

    const stream = new ReadableStream({
      async start(controller) {
        // 1) Notify client if conversation was created here
        if (createdConversation?.id) {
          try {
            sendEvent(controller, "meta", {
              type: "conversationCreated",
              conversation: createdConversation,
            });
          } catch {}
        }

        // 2) OPTIMISTIC TITLE
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

        // 3) STREAM
        let full = "";

        try {
          const reqPayload = {
            contents: mapMessages(contextMessages),
            generationConfig: {
              temperature: 0.85,
              topP: 0.9,
              maxOutputTokens: 4096,
            },
          };

          if (sysPrompt) {
            reqPayload.systemInstruction = {
              role: "system",
              parts: [{ text: sysPrompt }],
            };
          }

          const result = await model.generateContentStream(reqPayload);

          for await (const chunk of result.stream) {
            let text = "";
            try {
              text = chunk.text() || "";
            } catch {
              continue;
            }

            if (!text) continue;

            full += text;
            sendEvent(controller, "token", { t: text });
          }
        } catch (err) {
          console.error("STREAM ERROR:", err);
          try {
            sendEvent(controller, "error", { message: "Stream error" });
          } catch {}
        }

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

            if (finalTitle) {
              await setConversationAutoTitle(userId, conversationId, finalTitle);

              sendEvent(controller, "meta", {
                type: "finalTitle",
                conversationId,
                title: finalTitle,
              });
            }
          }
        } catch (e) {
          console.error("Post-stream error:", e);
        } finally {
          try {
            sendEvent(controller, "done", { ok: true });
          } catch {}
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("❌ chat-stream failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
