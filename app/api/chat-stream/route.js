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

import { GoogleGenerativeAI } from "@google-generative-ai";
import { NextResponse } from "next/server";

import {
  generateOptimisticTitle,
  generateFinalTitle,
} from "@/lib/autoTitleEngine";

// Map Firestore messages -> Gemini format
function mapMessages(messages) {
  return messages.map((m) => ({
    // Với Gemini, role lịch sử nên dùng "user" / "model"
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

    // Đảm bảo có conversation trước khi làm bất cứ thứ gì
    if (!conversationId) {
      const conv = await saveConversation(userId, {
        title: "New Chat",
        createdAt: Date.now(),
      });
      conversationId = conv.id;
    }

    // Xác thực conversation thuộc về user hiện tại
    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      console.error("❌ INVALID CONVERSATION:", conversationId);
      return new Response("Conversation not found", { status: 404 });
    }

    // Lưu message của user
    await saveMessage({
      conversationId,
      userId,
      role: "user",
      content,
    });

    // Load lại toàn bộ history đã sort ASC
    const messages = await getMessages(conversationId);

    const sysPrompt =
      systemMode === "dev"
        ? "Developer mode: detailed technical output."
        : systemMode === "friendly"
        ? "Friendly, warm and helpful assistant."
        : "You are a helpful assistant.";

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // ---------- OPTIMISTIC TITLE (gửi rất sớm) ----------
        try {
          const optimisticTitle = await generateOptimisticTitle(content);
          if (optimisticTitle) {
            sendMeta(controller, {
              type: "optimisticTitle",
              conversationId,
              title: optimisticTitle,
            });
          }
        } catch (e) {
          console.error("Optimistic title error:", e);
        }

        // ---------- MAIN STREAM ----------
        let full = "";

        try {
          // THỬ STREAMING TRƯỚC
          const result = await model.generateContentStream({
            contents: mapMessages(messages),
            systemInstruction: { role: "system", parts: [{ text: sysPrompt }] },
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
            } catch (parseErr) {
              // Đây là nơi trước kia Gemini ném "Failed to parse stream"
              console.error("Chunk parse failed:", parseErr);
              continue;
            }

            if (!text) continue;

            full += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          // STREAM LỖI → LOG CHI TIẾT
          console.error("STREAM ERROR (primary):", err);

          // ---------- FALLBACK: NON-STREAMING ----------
          try {
            const fallback = await model.generateContent({
              contents: mapMessages(messages),
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

            const text = fallback?.response?.text?.() || "";
            full = (text || "").trim();

            if (full) {
              // Đẩy 1 lần toàn bộ nội dung về client
              controller.enqueue(encoder.encode(full));
            }
          } catch (fallbackErr) {
            console.error("STREAM FALLBACK ERROR (generateContent):", fallbackErr);
            // Không còn gì để stream nữa
            controller.close();
            return;
          }
        }

        // ---------- LƯU MESSAGE + AUTO TITLE ----------
        try {
          const trimmed = full.trim();
          if (trimmed) {
            // Lưu assistant message
            await saveMessage({
              conversationId,
              userId,
              role: "assistant",
              content: trimmed,
            });

            // FINAL TITLE (dùng toàn bộ transcript)
            const finalTitle = await generateFinalTitle({
              userId,
              conversationId,
              messages: [
                ...messages,
                { role: "assistant", content: trimmed },
              ],
            });

            if (finalTitle) {
              // Ghi title vào Firestore
              await setConversationAutoTitle(
                userId,
                conversationId,
                finalTitle
              );

              // Gửi meta để client update Zustand
              sendMeta(controller, {
                type: "finalTitle",
                conversationId,
                title: finalTitle,
              });
            }
          }
        } catch (postErr) {
          console.error("Post-stream error (save message / final title):", postErr);
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
