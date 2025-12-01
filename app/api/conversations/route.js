import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserConversations } from "@/lib/firestoreChat";
import { parseWhitelist } from "@/lib/whitelist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  let session;

  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.error("❌ getServerSession failed:", err);
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const whitelist = parseWhitelist(process.env.WHITELIST_EMAILS || "");

  if (whitelist.length && !whitelist.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const raw = await getUserConversations(email);
    const conversations = Array.isArray(raw) ? raw.filter(Boolean) : [];

    // ✅ always send a plain object wrapper → tránh mọi lỗi “payload must be object”
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (err) {
    console.error("❌ conversations GET error:", err);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}
