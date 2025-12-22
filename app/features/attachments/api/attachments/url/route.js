// /app/api/attachments/url/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireUser } from "@/app/features/chat/api/conversations/auth";
import { createSignedUrlForAttachmentId } from "@/lib/features/attachments/attachments";

export async function GET(req) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const data = await createSignedUrlForAttachmentId({ userId, id });
    return NextResponse.json({ ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/attachments/url error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
