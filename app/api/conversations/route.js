// /app/api/conversations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "./auth";
import { parseJsonBody } from "./validators";
import { sanitizeMessages } from "./sanitize";

import {
  getUserConversations,
  getConversation,
  saveConversation,
  updateConversationTitle,
  deleteConversation,
  setConversationGem,
  setConversationModel,
} from "@/lib/features/chat/conversations";
import { getMessages } from "@/lib/features/chat/messages";

// ------------------------------
// GET
// - /api/conversations            => list conversations
// - /api/conversations?id=<uuid>  => get messages for conversation (client is using this)
// ------------------------------
export async function GET(req) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    // ✅ If id provided => return messages
    if (id) {
      const convo = await getConversation(id);
      if (!convo || convo.userId !== userId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const messagesRaw = await getMessages(id);

      // ✅ sanitize: prevent null/undefined/invalid role from crashing client
      const messages = sanitizeMessages(messagesRaw);

      return NextResponse.json(
        { messages },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Default: list conversations
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
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await parseJsonBody(req, { fallback: {} });
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
// - set model (new): { id, model }
// ------------------------------
export async function PATCH(req) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // NOTE: keep strict parsing behavior (invalid JSON => throws => 500 as before)
    const body = await parseJsonBody(req);

    const { id, title } = body || {};
    const hasGemId = Object.prototype.hasOwnProperty.call(body || {}, "gemId");
    const gemId = body?.gemId ?? null;
    
    // ✅ NEW: Handle model field
    const hasModel = Object.prototype.hasOwnProperty.call(body || {}, "model");
    const model = body?.model ?? null;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    let conversation = null;

    // IMPORTANT: không đổi title trừ khi client gửi title explicitly
    if (typeof title === "string") {
      conversation = await updateConversationTitle(userId, id, title);
    }

    if (hasGemId) {
      conversation = await setConversationGem(userId, id, gemId);
    }

    // ✅ NEW: Handle model update
    if (hasModel && model) {
      conversation = await setConversationModel(userId, id, model);
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
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await parseJsonBody(req, { fallback: {} });
    const { id } = body || {};

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await deleteConversation(userId, id);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("DELETE /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// PUT (kept for backward compatibility)
// ------------------------------
export async function PUT(req) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await parseJsonBody(req, { fallback: {} });
    const { id } = body || {};

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const convo = await getConversation(id);
    if (!convo || convo.userId !== userId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messagesRaw = await getMessages(id);
    const messages = sanitizeMessages(messagesRaw);

    return NextResponse.json(
      { messages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("PUT /conversations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
