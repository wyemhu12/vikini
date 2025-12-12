// /app/api/conversations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getUserConversations,
  getConversation,
  getMessages,
  saveConversation,
  updateConversationTitle,
  deleteConversation,
} from "@/lib/postgresChat";

import { NextResponse } from "next/server";

// ------------------------------
// L1 CACHE — in-memory cache
// ------------------------------
let convoCache = new Map();
const TTL = 3000; // 3 seconds

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // CASE 1 — Load messages of a single conversation
    // GET /api/conversations?id=xxxx
    if (id) {
      const conversation = await getConversation(id);

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      if (conversation.userId !== email) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const messages = await getMessages(id);

      return NextResponse.json({ conversation, messages }, { status: 200 });
    }

    // CASE 2 — Load list of conversations (Sidebar)
    // GET /api/conversations
    const cached = convoCache.get(email);

    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(
        { conversations: cached.data },
        {
          status: 200,
          headers: {
            "Cache-Control": "s-maxage=3, stale-while-revalidate=30",
          },
        }
      );
    }

    const conversations = await getUserConversations(email);

    convoCache.set(email, {
      ts: Date.now(),
      data: conversations,
    });

    return NextResponse.json(
      { conversations },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=3, stale-while-revalidate=30",
        },
      }
    );
  } catch (err) {
    console.error("GET /conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// CREATE CONVERSATION
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const { title } = await req.json();

    const conv = await saveConversation(email, { title: title || "New Chat" });

    convoCache.delete(email);

    return NextResponse.json({ conversation: conv }, { status: 200 });
  } catch (err) {
    console.error("POST /conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// RENAME CONVERSATION
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const { id, title } = await req.json();

    // Ownership enforcement nằm trong data layer khi cần,
    // nhưng để tránh đổi behavior quá mạnh, vẫn giữ logic tương tự hiện tại:
    const existing = await getConversation(id);
    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (existing.userId !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await updateConversationTitle(id, title);

    convoCache.delete(email);

    return NextResponse.json({ conversation: updated }, { status: 200 });
  } catch (err) {
    console.error("PATCH /conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE CONVERSATION
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const { id } = await req.json();

    await deleteConversation(email, id);

    convoCache.delete(email);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /conversations error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
