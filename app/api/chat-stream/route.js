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

// Map Firestore messages -> Gemini format
function buildGeminiMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// ---------------------
// AUTO TITLE FUNCTION
// ---------------------
async function autoTitleConversation({ userId, conversationId, history }) {
  try {
    const userMsgs = history.filter((m) => m.role === "user");
    if (userMsgs.length !== 1) return; // only auto title on first message

    const prompt = `
Generate a short, concise conversation title based on the user's first message.
Rules:
- Maximum 6 words.
- No emojis.
- No quotes.
- No punctuation at the end.
User message:
${userMsgs[0].content}
    `.trim();

    const titleRes = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 20,
      },
    });

    const raw = titleRes.response.text() || "";
    const clean = raw
      .replace(/["']/g, "")
      .replace(/\.$/, "")
      .trim()
      .slice(0, 80);

    if (!clean) return;

    await saveConversation(userId, {
      id: conversationId,
      title: clean,
      autoTitled: true,
    });
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
    console.log("🔥 BODY:", body);

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

    // tạo conversation nếu chưa có
    if (!convId) {
      const convo = await saveConversation(userId, {
        title: "New chat",
        autoTitled: false,
      });
      convId = convo.id;
    }

    // lưu user message
    await saveMessage({
      conversationId: convId,
      userId,
      role: "user",
      content,
    });

    // load lại history
    const history = await getMessages(convId);

    // system prompt
    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: give detailed and technical answers."
        : systemMode === "friendly"
        ? "Friendly mode: warm and casual."
        : "You are a helpful and intelligent assistant.";

    const contents = buildGeminiMessages(history);

    const result = await model.generateContentStream({
      contents,
      systemInstruction: {
        role: "system",
        parts: [{ text: sysPrompt }],
      },
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        topP: 0.9,
        topK: 40,
      },
    });

    const encoder = new TextEncoder();
    let finalText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text() || "";
            finalText += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          console.error("❌ STREAM ERROR:", err);
          controller.enqueue(encoder.encode("[Stream error]"));
        } finally {
          controller.close();

          // lưu assistant message sau khi stream xong
          const trimmed = finalText.trim();
          if (trimmed.length > 0) {
            await saveMessage({
              conversationId: convId,
              role: "assistant",
              content: trimmed,
            });

            // Auto title nếu là message đầu tiên
            await autoTitleConversation({
              userId,
              conversationId: convId,
              history: [...history, { role: "assistant", content: trimmed }],
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
