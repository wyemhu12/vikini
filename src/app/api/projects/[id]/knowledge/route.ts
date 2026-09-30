/**
 * Knowledge API Routes for a Project
 * GET: List documents in project (with opportunistic cleanup)
 * POST: Upload new document (pre-insert check, strict 400 rejection for embedding_model)
 * DELETE: Delete a document
 */
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import {
  getProjectDocuments,
  uploadDocument,
  deleteDocument,
  cleanupStuckProcessingDocuments,
} from "@/lib/features/projects/knowledge.server";
import { getProject } from "@/lib/features/projects/projects.server";
import { UnauthorizedError, ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";
import { isSupportedFileType, ALL_SUPPORTED_EXTENSIONS } from "@/types/projects";

const routeLogger = logger.withContext("api/projects/[id]/knowledge");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/knowledge - List documents in project
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    // 1. Verify project exists and user owns it
    const project = await getProject(projectId, userId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    // 2. Opportunistic cleanup for stuck processing documents in this project (non-blocking)
    try {
      await cleanupStuckProcessingDocuments(projectId);
    } catch (cleanupErr) {
      routeLogger.warn("Opportunistic cleanup failed, continuing", { error: cleanupErr });
    }

    const documents = await getProjectDocuments(projectId, userId);

    return success({
      documents,
      project_id: projectId,
      storage_used_bytes: project.storage_bytes,
    });
  } catch (err: unknown) {
    routeLogger.error("Failed to list documents", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch documents", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

const uploadSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  mimeType: z.string().optional(),
});

/**
 * POST /api/projects/[id]/knowledge - Upload a document
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    // Verify project exists and user owns it
    const project = await getProject(projectId, userId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    const rawBody = await req.json();

    // Strict Rejection 400: embedding_model is immutable and cannot be specified
    if (rawBody && typeof rawBody === "object" && "embedding_model" in rawBody) {
      throw new ValidationError("embedding_model cannot be specified for knowledge uploads");
    }

    let parsed;
    try {
      parsed = uploadSchema.parse(rawBody);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        throw new ValidationError(`Invalid request: ${e.issues[0].message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    // Validate file type
    if (!isSupportedFileType(parsed.filename)) {
      throw new ValidationError(
        `Unsupported file type. Allowed: ${ALL_SUPPORTED_EXTENSIONS.join(", ")}`
      );
    }

    const document = await uploadDocument({
      projectId,
      userId,
      filename: parsed.filename,
      content: parsed.content,
      mimeType: parsed.mimeType,
    });

    routeLogger.info(`Uploaded document: ${document.filename} (${document.id})`);
    return success({ document }, HTTP_STATUS.CREATED);
  } catch (err: unknown) {
    routeLogger.error("Failed to upload document", err);
    if (err instanceof AppError) return errorFromAppError(err);
    if (err instanceof Error && err.message.includes("limit")) {
      return error(err.message, HTTP_STATUS.FORBIDDEN);
    }
    if (err instanceof Error && err.message.includes("Storage")) {
      return error(err.message, HTTP_STATUS.FORBIDDEN);
    }
    return error("Failed to upload document", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * DELETE /api/projects/[id]/knowledge?documentId=xxx - Delete a document
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    // Verify project exists
    const project = await getProject(projectId, userId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    // Get documentId from query params
    const documentId = req.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      throw new ValidationError("documentId is required");
    }

    await deleteDocument(documentId, userId);

    routeLogger.info(`Deleted document: ${documentId}`);
    return success({ deleted: true });
  } catch (err: unknown) {
    routeLogger.error("Failed to delete document", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete document", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
