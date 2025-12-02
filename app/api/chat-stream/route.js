export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { parseWhitelist } from "@/lib/whitelist";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is not set.");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages = [], chatId, metadata } = body;

  const email = session.user.email.toLowerCase();
  const whitelist = parseWhitelist(process.env.WHITELIST_EMAILS || "");

  if (whitelist.length && !whitelist.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!checkRateLimit(email)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: "Messages missing" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  });

  try {
    const last = messages[messages.length - 1];
    const userContent = typeof last?.content === "string" ? last.content : "";

    if (!userContent) {
      return NextResponse.json(
        { error: "Last message content missing" },
        { status: 400 }
      );
    }

    const chat = await model.startChat({ history: [] });
    const stream = await chat.sendMessageStream(userContent);

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          for await (const chunk of stream.stream) {
            if (!chunk || typeof chunk.text !== "function") continue;

            const text = chunk.text();
            if (!text) continue;

            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          console.error("❌ chat-stream streaming error:", err);
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("❌ chat-stream error:", err);
    return NextResponse.json({ error: "ChatStream failed" }, { status: 500 });
  }
}
