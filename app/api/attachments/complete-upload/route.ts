export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { verifyAndCreateAttachment } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/attachments/complete-upload");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const json = await req.json().catch(() => ({}));

    const conversationId = String(json.conversationId || "").trim();
    const path = String(json.path || "").trim();
    const filename = String(json.filename || "").trim();
    const sizeBytes = Number(json.sizeBytes || 0);
    const mimeType = String(json.mimeType || "").trim();

    if (!conversationId || !path || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const attachment = await verifyAndCreateAttachment({
      userId,
      conversationId,
      path,
      filename,
      sizeBytes,
      mimeType,
    });

    return NextResponse.json({ attachment });
  } catch (err) {
    const error = err as Error;
    routeLogger.error("POST error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
