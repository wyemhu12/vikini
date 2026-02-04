/**
 * Projects API Routes
 * GET: List user projects
 * POST: Create new project
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import {
  getUserProjects,
  createProject,
  getUserTier,
  getTierLimits,
} from "@/lib/features/projects/projects.server";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("api/projects");

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  icon: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  embedding_model: z.enum(["text-embedding-004", "gemini-embedding-001"]).optional(),
});

/**
 * GET /api/projects - List all projects for current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    const [projects, tier] = await Promise.all([getUserProjects(userId), getUserTier(userId)]);

    const limits = getTierLimits(tier);

    return success({
      projects,
      tier,
      limits: {
        maxProjects: limits.maxProjects,
        currentProjects: projects.length,
        maxStorageBytesPerProject: limits.maxStorageBytesPerProject,
        availableModels: limits.embeddingModels,
      },
    });
  } catch (err: unknown) {
    routeLogger.error("Failed to list projects", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch projects", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * POST /api/projects - Create a new project
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    const body = await req.json();
    let parsed;
    try {
      parsed = createProjectSchema.parse(body);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const project = await createProject(userId, parsed);

    routeLogger.info(`Created project: ${project.name} (${project.id})`);
    return success({ project }, 201);
  } catch (err: unknown) {
    routeLogger.error("Failed to create project", err);
    if (err instanceof AppError) return errorFromAppError(err);
    if (err instanceof Error && err.message.includes("limit")) {
      return error(err.message, HTTP_STATUS.FORBIDDEN);
    }
    if (err instanceof Error && err.message.includes("already exists")) {
      return error(err.message, HTTP_STATUS.BAD_REQUEST);
    }
    return error("Failed to create project", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
