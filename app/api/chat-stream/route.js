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

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// AUTO TITLE FUNCTION (đã viết lại)
async function autoTitle({ userId, conversationId, messages }) {
  try {
    const convo = await getConversation(conversationId);
    if (!convo) return;
    if (convo.userId !== userId) return;

    // Nếu đã auto-titled HOẶC user đã rename thủ công -> bỏ qua
    if (convo.autoTitled || convo.renamed) return;

    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser?.content?.trim()) return;

    const prompt = `
Generate a very short title (max 5-6 words) summarizing the user's first message.
No emojis, no quotes.
User message:
${firstUser.content}
    `.trim();

    const res = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 20,
      },
    });

    let title = (res.response.text() || "")
      .replace(/["'“”]/g, "")
      .replace(/\.$/, "")
      .trim();

    if (!title) return;

    await setConversationAutoTitle(userId, conversationId, title);
    console.log("🎉 Auto Titled:", conversationId, "=>", title);
  } catch (err) {
    console.error("❌ Auto-title error:", err);
  }
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
    } = body || {};

    if (!content?.trim()) {
      return new Response("Empty content", { status: 400 });
    }

    // CREATE CONVERSATION IF NEEDED
    let convId = conversationId;
    if (!convId) {
      const convo = await saveConversation(userId, {
        title: "New chat",
        autoTitled: false,
      });
      convId = convo.id;
    }

    // SAVE USER MESSAGE
    await saveMessage({
      conversationId: convId,
      userId,
      role: "user",
      content,
    });

    // HISTORY BEFORE ASSISTANT RESPONSE
    const messages = await getMessages(convId);

    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: give technical detailed answers."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful, intelligent assistant.";

    const result = await model.generateContentStream({
      contents: mapMessages(messages),
      systemInstruction: { role: "system", parts: [{ text: sysPrompt }] },
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

    let fullText = "";
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text() || "";
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          console.error("STREAM ERROR", err);
        } finally {
          controller.close();

          const trimmed = fullText.trim();
          if (trimmed) {
            await saveMessage({
              conversationId: convId,
              role: "assistant",
              content: trimmed,
            });

            // RUN AUTO TITLE (chỉ tác động nếu chưa autoTitle / chưa rename)
            await autoTitle({
              userId,
              conversationId: convId,
              messages: [
                ...messages,
                { role: "assistant", content: trimmed },
              ],
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
