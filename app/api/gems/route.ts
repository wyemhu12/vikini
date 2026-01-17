// /app/api/gems/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getGemsForUser, createGem, updateGem, deleteGem } from "@/lib/features/gems/gems";
import { createGemSchema, updateGemSchema, deleteGemSchema } from "./validators";
import { logger } from "@/lib/utils/logger";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { HTTP_STATUS } from "@/lib/utils/constants";

const routeLogger = logger.withContext("/api/gems");

interface GemRow {
  id: string;
  slug?: string | null;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_premade?: boolean;
  isPremade?: boolean;
  latestVersion?: number;
  instructions?: string;
  instruction?: string;
  [key: string]: unknown;
}

interface GemForClient {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  icon: string;
  color: string;
  isPremade: boolean;
  latestVersion: number;
  instructions: string;
}

function mapGemForClient(row: GemRow | null): GemForClient | null {
  if (!row) return null;

  const isPremade = row.is_premade === true || row.isPremade === true;

  return {
    id: row.id,
    slug: row.slug ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    icon: row.icon ?? "",
    color: row.color ?? "",
    // UI expects camelCase + versioned fields
    isPremade,
    latestVersion: typeof row.latestVersion === "number" ? row.latestVersion : 0,
    instructions:
      (typeof row.instructions === "string" && row.instructions) ||
      (typeof row.instruction === "string" && row.instruction) ||
      "",
  };
}

// ------------------------------
// GET: list premade + my gems (with latest instructions)
// ------------------------------
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();

    const gems = await getGemsForUser(userId);
    const mapped = (Array.isArray(gems) ? gems : [])
      .map(mapGemForClient)
      .filter((g): g is GemForClient => g !== null);

    return success({ gems: mapped });
  } catch (e: unknown) {
    const err = e as Error;
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to load gems", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// POST: create a custom gem (creates version 1 if gem_versions exists)
// ------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = createGemSchema.parse(rawBody);
    } catch (e) {
      const validationError = e as {
        errors?: Array<{ path: string[]; message: string }>;
        message?: string;
      };
      if (validationError.errors) {
        const firstError = validationError.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      throw new ValidationError(validationError?.message || "Invalid request body");
    }

    const gem = await createGem(userId, body);
    return success({ gem: mapGemForClient(gem as GemRow) });
  } catch (e: unknown) {
    const err = e as Error;
    routeLogger.error("POST error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to create gem", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// PATCH: update a custom gem (creates a new version if instructions provided)
// ------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = updateGemSchema.parse(rawBody);
    } catch (e) {
      const validationError = e as {
        errors?: Array<{ path: string[]; message: string }>;
        message?: string;
      };
      if (validationError.errors) {
        const firstError = validationError.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      throw new ValidationError(validationError?.message || "Invalid request body");
    }

    const { id, ...rest } = body;

    const gem = await updateGem(userId, id, rest);
    return success({ gem: mapGemForClient(gem as GemRow) });
  } catch (e: unknown) {
    const err = e as Error;
    routeLogger.error("PATCH error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update gem", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// DELETE: delete a custom gem (premade is read-only)
// ------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = deleteGemSchema.parse(rawBody);
    } catch (e) {
      const validationError = e as {
        errors?: Array<{ path: string[]; message: string }>;
        message?: string;
      };
      if (validationError.errors) {
        const firstError = validationError.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      throw new ValidationError(validationError?.message || "Invalid request body");
    }

    const { id } = body;

    await deleteGem(userId, id);
    return success({ ok: true });
  } catch (e: unknown) {
    const err = e as Error;
    routeLogger.error("DELETE error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to delete gem", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
