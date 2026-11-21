// /app/api/personas/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import {
  getPersonasForUser,
  createPersona,
  updatePersona,
  deletePersona,
  type PersonaRow,
} from "@/lib/features/personas/personas";
import { createPersonaSchema, updatePersonaSchema, deletePersonaSchema } from "./validators";
import { logger } from "@/lib/utils/logger";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { ValidationError, AppError, UnauthorizedError } from "@/lib/utils/errors";
import { HTTP_STATUS } from "@/lib/utils/constants";
import type { PersonaForClient } from "@/types/persona";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/core/rateLimit";

const routeLogger = logger.withContext("/api/personas");

async function checkRL(userId: string) {
  const rl = await consumeRateLimit(`api-personas:${userId}`);
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

function mapPersonaForClient(row: PersonaRow | null): PersonaForClient | null {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    tone: (row.tone as PersonaForClient["tone"]) ?? "default",
    useEmojis: row.use_emojis ?? true,
    useHeadersLists: row.use_headers_lists ?? true,
    userContext: row.user_context ?? "",
    customInstructions: row.custom_instructions ?? "",
    icon: row.icon ?? "",
    color: row.color ?? "",
    isPremade: row.is_premade ?? false,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

// ------------------------------
// GET: list my personas
// ------------------------------
export async function GET(_req?: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();
    const rlError = await checkRL(userId);
    if (rlError) return rlError;

    const personas = await getPersonasForUser(userId);
    const mapped = (Array.isArray(personas) ? personas : [])
      .map(mapPersonaForClient)
      .filter((p): p is PersonaForClient => p !== null);

    return success({ personas: mapped });
  } catch (e: unknown) {
    routeLogger.error("GET error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
    return error("Failed to load personas", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// POST: create a persona
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
      body = createPersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const persona = await createPersona(userId, body);
    return success({ persona: mapPersonaForClient(persona) });
  } catch (e: unknown) {
    routeLogger.error("POST error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
    return error("Failed to create persona", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// PATCH: update a persona
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
      body = updatePersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const { id, ...rest } = body;

    const persona = await updatePersona(userId, id, rest);
    return success({ persona: mapPersonaForClient(persona) });
  } catch (e: unknown) {
    routeLogger.error("PATCH error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
    return error("Failed to update persona", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// DELETE: delete a persona
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
      body = deletePersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      throwZodValidationError(e);
    }

    const { id } = body;

    await deletePersona(userId, id);
    return success({ ok: true });
  } catch (e: unknown) {
    routeLogger.error("DELETE error:", e);
    if (e instanceof AppError) return errorFromAppError(e);
    return error("Failed to delete persona", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
