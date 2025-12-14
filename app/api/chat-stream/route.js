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
import { getSystemPrompt } from "@/app/utils/config";

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

function formatTranscriptForSummary(messages) {
  // keep compact; avoid huge prompt
  return (messages || [])
    .map((m) => {
      const role =
        m.role === "assistant" ? "ASSISTANT" : m.role === "user" ? "USER" : "OTHER";
      return `${role}: ${String(m.content || "").trim()}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function checkpointSummaryIfNeeded({ conversationId, language = "vi" }) {
  // If overflow exists (len > CONTEXT_MESSAGE_LIMIT), summarize overflow and trim buffer back to last 20
  const len = await getContextLength(conversationId);
  if (len <= CONTEXT_MESSAGE_LIMIT) return;

  const overflow = await getOverflowForSummary(conversationId, CONTEXT_MESSAGE_LIMIT);
  if (!overflow || overflow.length === 0) return;

  const prevSummary = await getSummary(conversationId);
  const transcript = formatTranscriptForSummary(overflow);

  // Minimal, deterministic-style summarizer prompt
  const sys =
    language === "en"
      ? "You are a summarization engine. Maintain a running conversation summary for future context. Keep it concise, factual, and actionable. Include: user goals, constraints, preferences, decisions, open tasks, and key technical details. Do not add new information."
      : "Bạn là bộ máy tóm tắt. Hãy duy trì “tóm tắt chạy” của cuộc trò chuyện để dùng làm ngữ cảnh về sau. Viết ngắn gọn, đúng sự thật, có thể hành động được. Bao gồm: mục tiêu, ràng buộc, sở thích, quyết định, việc đang mở, và chi tiết kỹ thuật quan trọng. Không bịa thêm.";

  const userText =
    language === "en"
      ? `Previous summary (if any):\n${prevSummary || "(none)"}\n\nNew transcript to incorporate:\n${transcript}\n\nReturn the UPDATED summary only.`
      : `Tóm tắt trước đó (nếu có):\n${prevSummary || "(chưa có)"}\n\nĐoạn hội thoại mới cần gộp vào:\n${transcript}\n\nChỉ trả về BẢN TÓM TẮT ĐÃ CẬP NHẬT.`;

  try {
    const res = await model.generateContent({
      systemInstruction: { role: "system", parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.2, topP: 0.9, maxOutputTokens: 512 },
    });

    const nextSummary = res?.response?.text?.() ? res.response.text().trim() : "";
    if (!nextSummary) return;

    await setSummary(conversationId, nextSummary);

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

    // Rate limit per user (email). Minimal patch: in-memory Map (per serverless instance on Vercel).
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

    let {
      conversationId,
      content,
      systemMode = "default",
      language = "vi",
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    // Normalize language
    if (language !== "vi" && language !== "en") language = "vi";

    // Nếu conversationId chưa có, tạo conversation ở đây và báo client qua META
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

    // --- Load short-term context (last 20) ---
    let contextMessages = await getContext(conversationId, CONTEXT_MESSAGE_LIMIT);

    // Gemini requires non-empty contents
    if (!contextMessages || contextMessages.length === 0) {
      contextMessages = [{ role: "user", content }];
    }

    // Pull running summary (if any) and inject into system prompt
    const runningSummary = await getSummary(conversationId);

    // Sync system prompt with UI
    const baseSysPrompt =
      typeof getSystemPrompt === "function"
        ? getSystemPrompt(systemMode, language)
        : systemMode === "dev"
        ? "Developer mode: detailed technical output."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful assistant.";

    const sysPrompt = runningSummary
      ? `${baseSysPrompt}\n\n[Conversation summary for context]\n${runningSummary}`
      : baseSysPrompt;

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
          const result = await model.generateContentStream({
            contents: mapMessages(contextMessages),
            systemInstruction: {
              role: "system",
              parts: [{ text: sysPrompt }],
            },
            generationConfig: {
              temperature: 0.85,
              topP: 0.9,
              maxOutputTokens: 4096,
            },
          });

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

            // ✅ Summary checkpoint (limit messages + running summary)
            await checkpointSummaryIfNeeded({ conversationId, language });
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
