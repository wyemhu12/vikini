// /app/api/attachments/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { uploadAttachment } from "@/lib/features/attachments/attachments";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const form = await req.formData();

    const conversationId = String(form.get("conversationId") || "").trim();
    const messageIdRaw = form.get("messageId");
    const messageId = messageIdRaw ? String(messageIdRaw).trim() : null;

    const file = form.get("file");
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const attachment = await uploadAttachment({
      userId,
      conversationId,
      messageId,
      file,
      filename: file.name,
    });

    return NextResponse.json({ attachment }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const error = err as Error;
    console.error("POST /api/attachments/upload error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

