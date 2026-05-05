/**
 * Files API — List & Delete
 * GET  /api/files?conversationId=xxx — List files
 * DELETE /api/files?id=xxx — Delete single file
 * DELETE /api/files?conversationId=xxx — Delete all files in conversation
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "@/app/api/conversations/auth";
import {
  listFiles,
  deleteFile,
  deleteFilesByConversation,
} from "@/lib/features/files/fileService.server";
import { logger } from "@/lib/utils/logger";
import { ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/files");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const { userId } = auth;
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (!conversationId) throw new ValidationError("Missing conversationId");
    if (!isValidUUID(conversationId)) throw new ValidationError("Invalid conversationId format");

    const files = await listFiles({ userId, conversationId });

    // Map to client-safe shape
    const items = files.map((f) => ({
      id: f.id,
      filename: f.filename,
      size_bytes: f.size_bytes,
      mime_type: f.mime_type,
      kind: f.kind,
      created_at: f.created_at,
      conversation_id: f.conversation_id,
      gemini_ready: !!f.gemini_file_uri,
    }));

    return success({ files: items });
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to list files", 500);
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

    // Try body if not in query params
    if (!id && !conversationId) {
      try {
        const body = (await req.json()) as { id?: string; conversationId?: string };
        id = body?.id || "";
      } catch {
        // Ignore
      }
    }

    // Delete all in conversation
    if (!id && conversationId) {
      if (!isValidUUID(conversationId)) throw new ValidationError("Invalid conversationId format");
      const result = await deleteFilesByConversation(userId, conversationId);
      return success(result);
    }

    // Delete single
    if (!id) throw new ValidationError("Missing id or conversationId");
    if (!isValidUUID(id)) throw new ValidationError("Invalid file id format");

    await deleteFile({ userId, id });
    return success({ ok: true });
  } catch (err: unknown) {
    routeLogger.error("DELETE error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete file", 500);
  }
}
