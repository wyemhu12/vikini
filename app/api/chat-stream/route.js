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
} from "@/lib/redisContext";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import {
  generateOptimisticTitle,
  generateFinalTitle,
} from "@/lib/autoTitleEngine";

// Map messages → Gemini format
function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

function sendMeta(controller, obj) {
  controller.enqueue(
    new TextEncoder().encode(`$$META:${JSON.stringify(obj)}$$\n`)
  );
}

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    let {
      conversationId,
      content,
      systemMode = "default",
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    // --- Ensure conversation exists ---
    if (!conversationId) {
      const conv = await saveConversation(userId, {
        title: "New Chat",
        createdAt: Date.now(),
      });
      conversationId = conv.id;
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

    // --- Load short-term context ---
    let contextMessages = await getContext(conversationId, 12);

    // 🔒 CRITICAL FIX: Gemini requires non-empty contents
    if (!contextMessages || contextMessages.length === 0) {
      contextMessages = [
        { role: "user", content },
      ];
    }

    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: detailed technical output."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful assistant.";

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // ---------- OPTIMISTIC TITLE ----------
        try {
          const optimisticTitle = await generateOptimisticTitle(content);
          if (optimisticTitle) {
            sendMeta(controller, {
              type: "optimisticTitle",
              conversationId,
              title: optimisticTitle,
            });
          }
        } catch {}

        // ---------- STREAM ----------
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
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          console.error("STREAM ERROR:", err);
        }

        // ---------- POST STREAM ----------
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

            // FINAL TITLE (NO DB READ)
            const finalTitle = await generateFinalTitle({
              userId,
              conversationId,
              messages: [
                ...contextMessages,
                { role: "assistant", content: trimmed },
              ],
            });

            if (finalTitle) {
              await setConversationAutoTitle(
                userId,
                conversationId,
                finalTitle
              );

              sendMeta(controller, {
                type: "finalTitle",
                conversationId,
                title: finalTitle,
              });
            }
          }
        } catch (e) {
          console.error("Post-stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("❌ chat-stream failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
