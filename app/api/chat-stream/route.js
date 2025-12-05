// app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getMessages,
  saveConversation,
  saveMessage,
} from "@/lib/firestoreChat";

import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

function buildGeminiMessages(messages) {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userId = session.user.email.toLowerCase();

    const body = await req.json();
    console.log("🔥 BODY:", body);
    console.log("🔥 conversationId:", body?.conversationId);
    console.log("🔥 content:", body?.content);
    const {
      conversationId,
      content,
      systemMode = "default",
      language = "vi",
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    let convId = conversationId;

    if (!convId) {
      const convo = await saveConversation(userId, {
        title: "New chat",
        autoTitled: false,
      });
      convId = convo.id;
    }

    await saveMessage({
      conversationId: convId,
      userId,
      role: "user",
      content,
    });

    const history = await getMessages(convId);

    let sysPrompt =
      systemMode === "dev"
        ? "Developer mode: give detailed and technical answers."
        : systemMode === "friendly"
        ? "Friendly mode: warm and casual."
        : "You are a helpful and intelligent assistant.";

    const geminiInput = [
      { role: "system", parts: [{ text: sysPrompt }] },
      ...buildGeminiMessages(history),
    ];

    const result = await model.generateContentStream({
      contents: geminiInput,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        topP: 0.9,
        topK: 40,
      },
    });

    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text() || "";
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          controller.enqueue(encoder.encode("[Stream error]"));
        } finally {
          controller.close();

          if (fullText.trim().length > 0) {
            await saveMessage({
              conversationId: convId,
              role: "assistant",
              content: fullText.trim(),
            });
          }
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("❌ chat-stream error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
