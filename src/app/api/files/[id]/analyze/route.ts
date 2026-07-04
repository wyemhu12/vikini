/**
 * Files API - AI analysis of a file
 * POST /api/files/[id]/analyze - Analyze file content with AI
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import { downloadFileBytes } from "@/lib/features/files/fileService.server";
import { analyzeWithAI } from "@/lib/features/files/fileProcessors";
import { logger } from "@/lib/utils/logger";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/files/[id]/analyze");

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const { id } = await params;

    if (!id) throw new ValidationError("Missing file id");

    const { row, bytes } = await downloadFileBytes({ userId, id });
    const analysis = await analyzeWithAI(new Uint8Array(bytes), row.mime_type, row.filename);

    return success({ analysis, filename: row.filename });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to analyze file", 500);
  }
}
