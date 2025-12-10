// app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getConversation,
  getMessages,
  saveConversation,
  saveMessage,
  setConversationAutoTitle,
} from "@/lib/firestoreChat";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import {
  generateOptimisticTitle,
  generateFinalTitle,
} from "@/lib/autoTitleEngine";

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
      language = "vi",
      isRegenerate,
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    // FIX 1 — Validate conversationId BEFORE anything
    if (!conversationId) {
      const conv = await saveConversation(userId, {
        title: "New Chat",
        createdAt: Date.now(),
      });
      conversationId = conv.id;
    }

    // FIX 2 — Ensure conversation exists
    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      console.error("❌ INVALID CONVERSATION:", conversationId);
      return new Response("Conversation not found", { status: 404 });
    }

    // Save user message
    await saveMessage({
      conversationId,
      userId,
      role: "user",
      content,
      createdAt: Date.now(),
    });

    // Load message history BEFORE generating response
    const messages = await getMessages(conversationId);

    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: detailed technical output."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful assistant.";

    // Prepare streaming
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // OPTIMISTIC TITLE
        const optimisticTitle = await generateOptimisticTitle(content);
        if (optimisticTitle) {
          sendMeta(controller, {
            type: "optimisticTitle",
            conversationId,
            title: optimisticTitle,
          });
        }

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

          // STREAM CHUNKS
          for await (const chunk of result.stream) {
            const text = chunk.text() || "";
            full += text;
            controller.enqueue(encoder.encode(text));
          }

          // SAVE FINAL MESSAGE
          const trimmed = full.trim();
          if (trimmed) {
            await saveMessage({
              conversationId,
              role: "assistant",
              content: trimmed,
              createdAt: Date.now(),
            });

            // FINAL TITLE (slow)
            const finalTitle = await generateFinalTitle({
              userId,
              conversationId,
              messages: [...messages, { role: "assistant", content: trimmed }],
            });

            if (finalTitle) {
              await setConversationAutoTitle(userId, conversationId, finalTitle);

              sendMeta(controller, {
                type: "finalTitle",
                conversationId,
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
