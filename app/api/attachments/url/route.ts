// /app/api/attachments/url/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { createSignedUrlForAttachmentId } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/attachments/url");

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ValidationError("Missing id");

    const data = await createSignedUrlForAttachmentId({ userId, id });
    return success(data);
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to get URL", 500);
  }
}
