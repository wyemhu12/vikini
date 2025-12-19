// /app/api/chat-stream/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { checkRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

import { handleChatStreamCore } from "./chatStreamCore";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.email.toLowerCase();

    const allowed = checkRateLimit(`chat-stream:${userId}`);
    if (!allowed) {
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return await handleChatStreamCore({ req, userId });
  } catch (e) {
    console.error("chat-stream route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
