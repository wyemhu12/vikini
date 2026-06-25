// /app/api/personas/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
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

const routeLogger = logger.withContext("/api/personas");

// Type guard for Zod-like validation errors
interface ZodLikeError {
  errors?: Array<{ path: string[]; message: string }>;
  message?: string;
}

function isZodLikeError(e: unknown): e is ZodLikeError {
  return typeof e === "object" && e !== null && ("errors" in e || "message" in e);
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
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

// ------------------------------
// GET: list my personas
// ------------------------------
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) throw new UnauthorizedError();

    const userId = session.user.email.toLowerCase();

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
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = createPersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      if (isZodLikeError(e) && e.errors) {
        const firstError = e.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      const message = isZodLikeError(e) ? e.message : "Invalid request body";
      throw new ValidationError(message || "Invalid request body");
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
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = updatePersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      if (isZodLikeError(e) && e.errors) {
        const firstError = e.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      const message = isZodLikeError(e) ? e.message : "Invalid request body";
      throw new ValidationError(message || "Invalid request body");
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
    const rawBody = await req.json().catch(() => ({}));
    let body;
    try {
      body = deletePersonaSchema.parse(rawBody);
    } catch (e: unknown) {
      if (isZodLikeError(e) && e.errors) {
        const firstError = e.errors[0];
        const field = firstError.path.join(".");
        throw new ValidationError(`${field}: ${firstError.message}`);
      }
      const message = isZodLikeError(e) ? e.message : "Invalid request body";
      throw new ValidationError(message || "Invalid request body");
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
