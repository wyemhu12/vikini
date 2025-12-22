// /app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/features/auth/auth";

import { consumeRateLimit, rateLimitHeaders } from "@/lib/core/rateLimit";
import { NextResponse } from "next/server";

import { handleChatStreamCore } from "./chatStreamCore";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.email.toLowerCase();

    const rl = await consumeRateLimit(`chat-stream:${userId}`);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfterSeconds: rl.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...rateLimitHeaders(rl),
          },
        }
      );
    }

    return await handleChatStreamCore({ req, userId });
  } catch (e) {
    console.error("chat-stream route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
