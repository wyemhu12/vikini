// /app/api/attachments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import {
  listAttachmentsForConversation,
  deleteAttachmentById,
  deleteAttachmentsByConversation,
} from "@/lib/features/attachments/attachments";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    const attachments = await listAttachmentsForConversation({ userId, conversationId });
    return NextResponse.json({ attachments }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const error = err as Error;
    console.error("GET /api/attachments error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);

    const conversationId = url.searchParams.get("conversationId");
    let id = url.searchParams.get("id");

    if (!id) {
      try {
        const body = (await req.json()) as { id?: string };
        id = body?.id || "";
      } catch {
        // Ignore JSON parse errors
      }
    }

    // DELETE all in conversation (used by Files menu)
    if (!id && conversationId) {
      await deleteAttachmentsByConversation({ userId, conversationId });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!id) {
      if (conversationId) {
        await deleteAttachmentsByConversation({ userId, conversationId });
        return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteAttachmentById({ userId, id });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const error = err as Error;
    console.error("DELETE /api/attachments error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

