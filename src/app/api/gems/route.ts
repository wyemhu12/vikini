// /app/api/gems/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getGemsForUser, createGem, updateGem, deleteGem } from "@/lib/features/gems/gems";
import { createGemSchema, updateGemSchema, deleteGemSchema } from "./validators";
import { logger } from "@/lib/utils/logger";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { HTTP_STATUS } from "@/lib/utils/constants";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/core/rateLimit";

const routeLogger = logger.withContext("/api/gems");

async function checkRL(userId: string) {
  const rl = await consumeRateLimit(`api-gems:${userId}`);
  if (!rl.allowed) {
    const res = error(
      "Rate limit exceeded",
      HTTP_STATUS.RATE_LIMIT_EXCEEDED,
      "RATE_LIMIT_EXCEEDED"
    );
    Object.entries(rateLimitHeaders(rl)).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  return null;
}

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

function throwZodValidationError(e: unknown): never {
  if (e instanceof z.ZodError) {
    const firstIssue = e.issues[0];
    const field = firstIssue?.path.join(".");
    throw new ValidationError(
      field ? `${field}: ${firstIssue.message}` : firstIssue?.message || "Invalid request body"
    );
  }
  throw new ValidationError("Invalid request body");
}

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
export async function GET(_req?: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rlError = await checkRL(userId);
    if (rlError) return rlError;

    const gems = await getGemsForUser(userId);
    const mapped = (Array.isArray(gems) ? gems : [])
      .map(mapGemForClient)
      .filter((g): g is GemForClient => g !== null);

    return success({ gems: mapped });
  } catch (e: unknown) {
    routeLogger.error("GET error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
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
    const rlError = await checkRL(userId);
    if (rlError) return rlError;

    const rawBody = await parseJsonBody(req);
    let body;
    try {
      body = createGemSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const gem = await createGem(userId, body);
    return success({ gem: mapGemForClient(gem as GemRow) });
  } catch (e: unknown) {
    routeLogger.error("POST error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
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
    const rlError = await checkRL(userId);
    if (rlError) return rlError;

    const rawBody = await parseJsonBody(req);
    let body;
    try {
      body = updateGemSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const { id, ...rest } = body;

    const gem = await updateGem(userId, id, rest);
    return success({ gem: mapGemForClient(gem as GemRow) });
  } catch (e: unknown) {
    routeLogger.error("PATCH error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
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
    const rlError = await checkRL(userId);
    if (rlError) return rlError;

    const rawBody = await parseJsonBody(req);
    let body;
    try {
      body = deleteGemSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const { id } = body;

    await deleteGem(userId, id);
    return success({ ok: true });
  } catch (e: unknown) {
    routeLogger.error("DELETE error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
    return error("Failed to delete gem", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
