// /app/api/attachments/url/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { createSignedUrlForAttachmentId } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/attachments/url");

export async function GET(req: NextRequest) {
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
    const error = err as Error;
    routeLogger.error("GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}
