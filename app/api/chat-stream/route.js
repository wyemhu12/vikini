// app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getConversation,
  getMessages,
  getUserConversations,
  saveConversation,
  saveMessage,
  setConversationAutoTitle,
} from "@/lib/firestoreChat";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// NEW: auto-title engine
import {
  generateOptimisticTitle,
  generateFinalTitle,
  normalizeTitle,
} from "@/lib/autoTitleEngine";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// Utility: gửi metadata dạng JSON trong stream
function sendMeta(controller, obj) {
  controller.enqueue(
    new TextEncoder().encode(`$$META:${JSON.stringify(obj)}$$\n`)
  );
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    const {
      conversationId,
      content,
      systemMode = "default",
      language = "vi",
      isRegenerate,
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    // CREATE CONVERSATION IF NEEDED
    let convId = conversationId;
    if (!convId) {
      const convo = await saveConversation(userId, {
        title: "New Chat",
        createdAt: Date.now(),
      });
      convId = convo.id;
    }

    // SAVE USER MESSAGE
    await saveMessage({
      conversationId: convId,
      userId,
      role: "user",
      content,
      createdAt: Date.now(),
    });

    // HISTORY BEFORE ASSISTANT RESPONSE
    const messages = await getMessages(convId);

    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: give technical detailed answers."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful, intelligent assistant.";

    // =============== 1) GENERATE OPTIMISTIC TITLE (FAST) ===============
    const optimisticTitle = await generateOptimisticTitle(content);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Gửi optimistic title trước khi gửi output từ model
        if (optimisticTitle) {
          sendMeta(controller, {
            type: "optimisticTitle",
            conversationId: convId,
            title: optimisticTitle,
          });
        }

        // ========== AI STREAM ==========
        try {
          const result = await model.generateContentStream({
            contents: mapMessages(messages),
            systemInstruction: { role: "system", parts: [{ text: sysPrompt }] },
            generationConfig: {
              temperature: 0.85,
              topP: 0.9,
              maxOutputTokens: 4096,
            },
          });

          let full = "";

          for await (const chunk of result.stream) {
            const text = chunk.text() || "";
            full += text;
            controller.enqueue(encoder.encode(text));
          }

          const trimmed = full.trim();
          if (trimmed) {
            await saveMessage({
              conversationId: convId,
              role: "assistant",
              content: trimmed,
              createdAt: Date.now(),
            });

            // =============== 2) FINAL TITLE ===============
            const finalTitle = await generateFinalTitle({
              userId,
              conversationId: convId,
              messages: [...messages, { role: "assistant", content: trimmed }],
            });

            if (finalTitle) {
              await setConversationAutoTitle(userId, convId, finalTitle);

              // Gửi final title về frontend
              sendMeta(controller, {
                type: "finalTitle",
                conversationId: convId,
                title: finalTitle,
              });
            }
          }

          controller.close();
        } catch (err) {
          console.error("STREAM ERROR", err);
          controller.error(err);
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
