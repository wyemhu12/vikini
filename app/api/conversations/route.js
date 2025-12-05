// app/api/conversations/route.js
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
} from "@/lib/firestoreChat";
import { parseWhitelist } from "@/lib/whitelist";

async function getAuthedUser(req) {
  let session;

  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error("❌ getServerSession failed:", err);
    throw new Error("Auth failure");
  }

  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const email = session.user.email.toLowerCase();
  const whitelist = parseWhitelist(process.env.WHITELIST_EMAILS || "");

  if (whitelist.length && !whitelist.includes(email)) {
    throw new Error("Forbidden");
  }

  return { session, email };
}

// --------- GET ---------
// - /api/conversations                -> list conversations
// - /api/conversations?id=123         -> one conversation + messages
export async function GET(req) {
  try {
    const { email } = await getAuthedUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Lấy 1 conv + messages
    if (id) {
      const conversation = await getConversation(id);
      if (!conversation || conversation.userId !== email) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      const messages = await getMessages(id);
      return NextResponse.json({ conversation, messages }, { status: 200 });
    }

    // Lấy list conv
    const conversations = await getUserConversations(email);
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (err) {
    console.error("❌ conversations GET error:", err);

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

// --------- POST ---------
// Tạo conversation mới
// body: { title? }
export async function POST(req) {
  try {
    const { email } = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title : "New chat";

    const conversation = await saveConversation(email, { title });

    return NextResponse.json({ conversation }, { status: 200 });
  } catch (err) {
    console.error("❌ conversations POST error:", err);

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}

// --------- PATCH ---------
// Đổi title
// body: { id, title }
export async function PATCH(req) {
  try {
    const { email } = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const { id, title } = body || {};

    if (!id || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "id and title are required" },
        { status: 400 }
      );
    }

    const conversation = await getConversation(id);
    if (!conversation || conversation.userId !== email) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const updated = await updateConversationTitle(id, title.trim());
    return NextResponse.json({ conversation: updated }, { status: 200 });
  } catch (err) {
    console.error("❌ conversations PATCH error:", err);

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

// --------- DELETE ---------
// body: { id }
export async function DELETE(req) {
  try {
    const { email } = await getAuthedUser(req);
    const body = await req.json().catch(() => ({}));
    const { id } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await deleteConversation(email, id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("❌ conversations DELETE error:", err);

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message === "Forbidden") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
