/**
 * Single Project API Routes
 * GET: Get project details
 * PATCH: Update project
 * DELETE: Delete project (cascade deletes KB)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getProject, updateProject, deleteProject } from "@/lib/features/projects/projects.server";
import { UnauthorizedError, ValidationError, NotFoundError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("api/projects/[id]");

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  embedding_model: z.enum(["text-embedding-004", "gemini-embedding-001"]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id] - Get project details with stats
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    const project = await getProject(projectId, userId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    return success({ project });
  } catch (err: unknown) {
    routeLogger.error("Failed to get project", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch project", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * PATCH /api/projects/[id] - Update project
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    const body = await req.json();
    let parsed;
    try {
      parsed = updateProjectSchema.parse(body);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const project = await updateProject(projectId, userId, parsed);

    routeLogger.info(`Updated project: ${project.name} (${project.id})`);
    return success({ project });
  } catch (err: unknown) {
    routeLogger.error("Failed to update project", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update project", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * DELETE /api/projects/[id] - Delete project
 * WARNING: This cascades to delete all KB documents and chunks
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    const { id: projectId } = await params;

    // Verify project exists
    const existing = await getProject(projectId, userId);
    if (!existing) {
      throw new NotFoundError("Project");
    }

    await deleteProject(projectId, userId);

    routeLogger.info(`Deleted project: ${existing.name} (${projectId})`);
    return success({ deleted: true });
  } catch (err: unknown) {
    routeLogger.error("Failed to delete project", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete project", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
