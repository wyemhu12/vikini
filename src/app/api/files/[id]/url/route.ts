/**
 * Files API - Single file operations
 * GET /api/files/[id]/url - Get signed download URL
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { createSignedUrl } from "@/lib/features/files/fileService.server";
import { logger } from "@/lib/utils/logger";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/files/[id]/url");

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const { id } = await params;

    if (!id) throw new ValidationError("Missing file id");

    const data = await createSignedUrl({ userId, id });
    return success(data);
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to get URL", 500);
  }
}
