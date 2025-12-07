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

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

function mapMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// ---------- Helpers cho auto-title ----------

// Title Case
function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

// Clean + chuẩn hóa title
function normalizeTitle(raw) {
  if (!raw) return "";

  // Lấy dòng đầu tiên (tránh trường hợp AI trả nhiều dòng)
  let title = String(raw).split("\n")[0];

  // Bỏ ngoặc, ngoặc kép, emoji, ký tự đặc biệt
  title = title
    .replace(/["'“”‘’`]/g, "")
    .replace(/[^\p{L}\p{N}\s\-]/gu, "")
    .replace(/\.+$/, "")
    .trim();

  // Giới hạn từ: tối đa 6 từ
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 6) {
    title = words.slice(0, 6).join(" ");
  }

  title = toTitleCase(title);

  // Fallback
  if (!title || title.length < 2) {
    title = "New Chat";
  }

  return title;
}

// AUTO TITLE FUNCTION (nâng cấp)
async function autoTitle({ userId, conversationId, messages }) {
  try {
    const convo = await getConversation(conversationId);
    if (!convo) return;
    if (convo.userId !== userId) return;

    // Nếu đã auto-titled HOẶC user đã rename thủ công -> bỏ qua
    if (convo.autoTitled || convo.renamed) return;

    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser?.content?.trim()) return;

    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n")
      .slice(0, 4000); // tránh prompt quá dài

    const prompt = `
You are a title-generation model.

Produce a short, semantic title summarizing the ENTIRE conversation so far.

Rules:
- 3–6 words only
- No emojis
- No quotes
- No sentence-ending punctuation
- Use Title Case (Capitalize Each Word)
- Avoid phrases like "User Asks About"
- Focus on the main intent

Conversation transcript:
${transcript}
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
        maxOutputTokens: 24,
      },
    });

    let raw = res.response.text() || "";
    let title = normalizeTitle(raw);

    // Bảo hiểm: nếu vẫn quá ngắn, dùng fallback theo câu hỏi đầu
    if (!title || title === "New Chat") {
      const fallback = firstUser.content.trim().split("\n")[0];
      title = normalizeTitle(fallback);
    }

    // Chống trùng lặp title trong cùng 1 user
    const all = await getUserConversations(userId);
    if (all.some((c) => c.id !== conversationId && c.title === title)) {
      let i = 2;
      while (
        all.some((c) => c.id !== conversationId && c.title === `${title} ${i}`)
      ) {
        i++;
      }
      title = `${title} ${i}`;
    }

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
