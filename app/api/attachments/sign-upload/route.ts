export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { getConversation } from "@/lib/features/chat/conversations";
import { createSignedUploadUrl } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/attachments/sign-upload");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const json = await req.json().catch(() => ({}));

    const conversationId = String(json.conversationId || "").trim();
    const filename = String(json.filename || "").trim();
    const fileType = String(json.fileType || "").trim();
    const fileSize = Number(json.fileSize || 0);

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }
    if (!filename || !fileSize) {
      return NextResponse.json({ error: "Missing file metadata" }, { status: 400 });
    }

    const convo = await getConversation(conversationId);
    if (!convo || convo.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await createSignedUploadUrl({
      userId,
      conversationId,
      filename,
      fileType,
      fileSize,
    });

    return NextResponse.json(result);
  } catch (err) {
    const error = err as Error;
    routeLogger.error("POST error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
