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

// ------- In-memory cache cho danh sách conversations (per Vercel instance) -------
const conversationCache = new Map(); // key: email, value: { conversations, updatedAt }

const CACHE_MAX_AGE_MS = 5_000; // trong 5s => luôn trả cache
const CACHE_STALE_MS = 25_000; // thêm 25s => SWR: trả cache + refresh nền

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

    // Lấy 1 conv + messages (không cache, vì ít gọi hơn)
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

    // ---------- Lấy list conv với cache + stale-while-revalidate ----------
    const cacheKey = email;
    const now = Date.now();
    const cached = conversationCache.get(cacheKey);

    // Nếu có cache
    if (cached) {
      const age = now - cached.updatedAt;

      // 1) Trong max-age: trả cache (HIT)
      if (age < CACHE_MAX_AGE_MS) {
        return NextResponse.json(
          { conversations: cached.conversations },
          {
            status: 200,
            headers: {
              "X-Cache": "hit",
              "Cache-Control":
                "private, max-age=5, stale-while-revalidate=25",
            },
          }
        );
      }

      // 2) Trong stale window: trả cache + refresh nền (STALE)
      if (age < CACHE_MAX_AGE_MS + CACHE_STALE_MS) {
        // refresh nền, không await
        getUserConversations(email)
          .then((convs) => {
            conversationCache.set(cacheKey, {
              conversations: convs,
              updatedAt: Date.now(),
            });
          })
          .catch((err) =>
            console.error("❌ SWR refresh conversations failed:", err)
          );

        return NextResponse.json(
          { conversations: cached.conversations },
          {
            status: 200,
            headers: {
              "X-Cache": "stale",
              "Cache-Control":
                "private, max-age=5, stale-while-revalidate=25",
            },
          }
        );
      }
      // Hết stale window → xuống dưới fetch mới (MISS/REFRESH)
    }

    // 3) Không có cache / cache quá cũ → fetch Firestore
    const conversations = await getUserConversations(email);
    conversationCache.set(cacheKey, { conversations, updatedAt: now });

    return NextResponse.json(
      { conversations },
      {
        status: 200,
        headers: {
          "X-Cache": cached ? "refresh" : "miss",
          "Cache-Control": "private, max-age=5, stale-while-revalidate=25",
        },
      }
    );
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

    // Invalidate cache user này
    conversationCache.delete(email);

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

    // Invalidate cache user này để lần GET sau lấy title mới
    conversationCache.delete(email);

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

    const conversation = await getConversation(id);
    if (!conversation || conversation.userId !== email) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    await deleteConversation(id);

    // Invalidate cache user này
    conversationCache.delete(email);

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
