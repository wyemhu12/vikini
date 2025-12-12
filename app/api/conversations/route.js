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

function sortConversations(list = []) {
  return [...list].sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || 0;
    const tb = b.updatedAt || b.createdAt || 0;
    return tb - ta;
  });
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email.toLowerCase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // ------------------------------
    // CASE 1 — Load messages
    // ------------------------------
    if (id) {
      const conversation = await getConversation(id);
      if (!conversation)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (conversation.userId !== email)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const messages = await getMessages(id);
      return NextResponse.json({ conversation, messages });
    }

    // ------------------------------
    // CASE 2 — Sidebar list
    // ------------------------------
    const cached = convoCache.get(email);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json(
        { conversations: cached.data },
        { headers: { "Cache-Control": "s-maxage=3, stale-while-revalidate=30" } }
      );
    }

    const raw = await getUserConversations(email);
    const conversations = sortConversations(raw);

    convoCache.set(email, {
      ts: Date.now(),
      data: conversations,
    });

    return NextResponse.json(
      { conversations },
      { headers: { "Cache-Control": "s-maxage=3, stale-while-revalidate=30" } }
    );
  } catch (err) {
    console.error("GET /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// CREATE
// ------------------------------
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = session.user.email.toLowerCase();
    const { title } = await req.json();

    const conv = await saveConversation(email, {
      title: title || "New Chat",
    });

    convoCache.delete(email);
    return NextResponse.json({ conversation: conv });
  } catch (err) {
    console.error("POST /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// RENAME
// ------------------------------
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = session.user.email.toLowerCase();
    const { id, title } = await req.json();

    const existing = await getConversation(id);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.userId !== email)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updated = await updateConversationTitle(id, title);
    convoCache.delete(email);

    return NextResponse.json({ conversation: updated });
  } catch (err) {
    console.error("PATCH /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// DELETE
// ------------------------------
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = session.user.email.toLowerCase();
    const { id } = await req.json();

    await deleteConversation(email, id);
    convoCache.delete(email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
