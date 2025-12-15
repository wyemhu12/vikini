// /app/api/conversations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getUserConversations,
  getConversation,
  getMessages,
  saveConversation,
  updateConversationTitle,
  deleteConversation,
  setConversationGem,
} from "@/lib/postgresChat";

// ------------------------------
// GET
// ------------------------------
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const conversations = await getUserConversations(userId);

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

    const userId = session.user.email.toLowerCase();
    const body = await req.json().catch(() => ({}));
    const title = body?.title || "New Chat";

    const conversation = await saveConversation(userId, { title });

    return NextResponse.json(
      { conversation },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// PATCH
// - rename (existing)
// - set gemId (new): { id, gemId } (gemId can be null)
// ------------------------------
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    const { id, title } = body || {};
    const hasGemId = Object.prototype.hasOwnProperty.call(body || {}, "gemId");
    const gemId = body?.gemId ?? null;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    let conversation = null;

    // IMPORTANT: không đổi title trừ khi client gửi title explicitly
    if (typeof title === "string") {
      conversation = await updateConversationTitle(userId, id, title);
    }

    if (hasGemId) {
      conversation = await setConversationGem(userId, id, gemId);
    }

    // fallback: return current
    if (!conversation) {
      const c = await getConversation(id);
      if (!c || c.userId !== userId)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      conversation = c;
    }

    return NextResponse.json(
      { conversation },
      { headers: { "Cache-Control": "no-store" } }
    );
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

    const userId = session.user.email.toLowerCase();
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await deleteConversation(userId, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("DELETE /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// (Optional) GET messages for a conversation
// If you already have a separate route for messages, keep that instead.
// ------------------------------
export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const convo = await getConversation(id);
    if (!convo || convo.userId !== userId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messages = await getMessages(id);
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("PUT /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
