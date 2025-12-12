// app/api/chat-stream/route.js
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

import { appendToContext, getContext } from "@/lib/redisContext";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import {
  generateOptimisticTitle,
  generateFinalTitleDebounced,
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
    const { conversationId: rawId, content, systemMode = "default" } =
      await req.json();

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    let conversationId = rawId;
    let createdConversation = null;

    if (!conversationId) {
      const conv = await saveConversation(userId, { title: "New Chat" });
      conversationId = conv.id;
      createdConversation = conv;
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      return new Response("Conversation not found", { status: 404 });
    }

    await appendToContext(conversationId, { role: "user", content });
    await saveMessage({ conversationId, userId, role: "user", content });

    let contextMessages = await getContext(conversationId, 12);
    if (!contextMessages || contextMessages.length === 0) {
      contextMessages = [{ role: "user", content }];
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
        if (createdConversation) {
          sendMeta(controller, {
            type: "conversationCreated",
            conversation: createdConversation,
          });
        }

        // Optimistic title
        const optimistic = await generateOptimisticTitle(content);
        if (optimistic) {
          sendMeta(controller, {
            type: "optimisticTitle",
            conversationId,
            title: optimistic,
          });
        }

        let full = "";

        try {
          const result = await model.generateContentStream({
            contents: mapMessages(contextMessages),
            systemInstruction: {
              role: "system",
              parts: [{ text: sysPrompt }],
            },
          });

          for await (const chunk of result.stream) {
            const text = chunk.text?.() || "";
            if (!text) continue;
            full += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (e) {
          console.error("Stream error:", e);
        }

        if (full.trim()) {
          await appendToContext(conversationId, {
            role: "assistant",
            content: full.trim(),
          });

          await saveMessage({
            conversationId,
            userId,
            role: "assistant",
            content: full.trim(),
          });

          // FINAL TITLE — DEBOUNCED
          generateFinalTitleDebounced({
            conversationId,
            messages: [
              ...contextMessages,
              { role: "assistant", content: full.trim() },
            ],
            onResult: async (title) => {
              await setConversationAutoTitle(userId, conversationId, title);
              sendMeta(controller, {
                type: "finalTitle",
                conversationId,
                title,
              });
            },
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("chat-stream error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
