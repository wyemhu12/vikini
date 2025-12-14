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
    const raw = await getUserConversations(email);
    const conversations = sortConversations(raw);

    // NOTE:
    // - Sidebar list là dữ liệu nhạy cảm theo user + cần "fresh" để UX cập nhật ngay.
    // - Tránh cache ở layer edge/serverless (Vercel) để không bị lệch trạng thái.
    return NextResponse.json(
      { conversations },
      { headers: { "Cache-Control": "no-store" } }
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
