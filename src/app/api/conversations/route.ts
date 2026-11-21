// /app/api/conversations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "./auth";
import {
  parseJsonBody,
  createConversationSchema,
  updateConversationSchema,
  deleteConversationSchema,
} from "./validators";
import { sanitizeMessages } from "./sanitize";
import { logger } from "@/lib/utils/logger";
import { NotFoundError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError } from "@/lib/utils/apiResponse";
import { HTTP_STATUS, CONVERSATION_DEFAULTS } from "@/lib/utils/constants";
import { createPerformanceMonitor } from "@/lib/utils/performance";

import {
  getUserConversations,
  getConversation,
  saveConversation,
  updateConversation,
  deleteConversation,
  type ConversationUpdatePatch,
} from "@/lib/features/chat/conversations";
import { getMessages } from "@/lib/features/chat/messages";

const routeLogger = logger.withContext("/api/conversations");

async function parseStrictJson(req: NextRequest): Promise<unknown> {
  try {
    return await parseJsonBody(req);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

function formatZodValidationError(e: unknown): ValidationError {
  if (e instanceof z.ZodError) {
    const firstIssue = e.issues[0];
    const field = firstIssue?.path.join(".");
    return new ValidationError(
      field ? `${field}: ${firstIssue.message}` : firstIssue?.message || "Invalid request body"
    );
  }
  return new ValidationError("Invalid request body");
}

// ------------------------------
// GET
// - /api/conversations            => list conversations
// - /api/conversations?id=<uuid>  => get messages for conversation (client is using this)
// ------------------------------
export async function GET(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/conversations", "GET");

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      perfMonitor.end(auth.response.status);
      return auth.response;
    }
    const { userId } = auth;
    perfMonitor.userId = userId;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    //  If id provided => return messages
    if (id) {
      // SECURITY: Validate UUID format to prevent injection
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        routeLogger.warn(`Invalid UUID format: ${id}`);
        perfMonitor.end(400, { operation: "getMessages", error: "invalid-uuid" });
        return errorFromAppError(new ValidationError("Invalid conversation ID format"));
      }

      const convo = await getConversation(id);
      if (!convo || convo.userId !== userId) {
        routeLogger.warn(`Conversation not found or access denied: ${id} for user: ${userId}`);
        perfMonitor.end(404, { operation: "getMessages", conversationId: id });
        return errorFromAppError(new NotFoundError("Conversation"));
      }

      const messagesRaw = await getMessages(id);
      const messages = sanitizeMessages(messagesRaw);

      perfMonitor.end(200, {
        operation: "getMessages",
        conversationId: id,
        messageCount: messages.length,
      });
      return success({ messages });
    }

    // Default: list conversations
    const conversations = await getUserConversations(userId);
    perfMonitor.end(200, { operation: "listConversations", count: conversations.length });
    return success({ conversations });
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);

    const statusCode = err instanceof AppError ? err.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    perfMonitor.end(statusCode, { error: true });

    if (err instanceof AppError) {
      return errorFromAppError(err);
    }

    return errorFromAppError(new AppError("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

// ------------------------------
// CREATE
// ------------------------------
export async function POST(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/conversations", "POST");

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      perfMonitor.end(auth.response.status);
      return auth.response;
    }
    const { userId } = auth;
    perfMonitor.userId = userId;

    const rawBody = await parseStrictJson(req);
    let body;
    try {
      body = createConversationSchema.parse(rawBody);
    } catch (e: unknown) {
      throw formatZodValidationError(e);
    }
    const title = body.title || CONVERSATION_DEFAULTS.TITLE;
    const model = body.model;
    const projectId = body.projectId;

    const conversation = await saveConversation(userId, { title, model, projectId });
    routeLogger.info(`Created conversation ${conversation?.id} for user: ${userId}`);

    perfMonitor.end(HTTP_STATUS.CREATED, {
      operation: "createConversation",
      conversationId: conversation?.id,
    });
    return success({ conversation });
  } catch (err: unknown) {
    routeLogger.error("POST error:", err);

    const statusCode = err instanceof AppError ? err.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    perfMonitor.end(statusCode, { error: true });

    if (err instanceof AppError) {
      return errorFromAppError(err);
    }

    return errorFromAppError(new AppError("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

// ------------------------------
// PATCH
// - rename (existing)
// - set gemId (new): { id, gemId } (gemId can be null)
// - set model (new): { id, model }
// ------------------------------
export async function PATCH(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/conversations", "PATCH");

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      perfMonitor.end(auth.response.status);
      return auth.response;
    }
    const { userId } = auth;
    perfMonitor.userId = userId;

    const rawBody = await parseStrictJson(req);
    let body;
    try {
      body = updateConversationSchema.parse(rawBody);
    } catch (e: unknown) {
      return errorFromAppError(formatZodValidationError(e));
    }

    const { id, title, gemId, model, projectId, personaId } = body;
    const hasGemId = Object.prototype.hasOwnProperty.call(rawBody, "gemId");
    const hasModel = Object.prototype.hasOwnProperty.call(rawBody, "model");
    const hasProjectId = Object.prototype.hasOwnProperty.call(rawBody, "projectId");
    const hasPersonaId = Object.prototype.hasOwnProperty.call(rawBody, "personaId");

    const patch: ConversationUpdatePatch = {};
    // IMPORTANT: do not alter title unless explicitly sent by client
    if (typeof title === "string") {
      patch.title = title;
    }
    if (hasGemId) {
      patch.gemId = gemId ?? null;
    }
    if (hasModel && model) {
      patch.model = model;
    }
    if (hasProjectId) {
      patch.projectId = projectId ?? null;
    }
    if (hasPersonaId) {
      patch.personaId = personaId ?? null;
    }

    const conversation = await updateConversation(userId, id, patch);
    if (!conversation) {
      routeLogger.warn(`Conversation not found: ${id} for user: ${userId}`);
      return errorFromAppError(new NotFoundError("Conversation"));
    }

    perfMonitor.end(200, {
      operation: "updateConversation",
      conversationId: id,
      updatedFields: { hasTitle: typeof title === "string", hasGemId, hasModel },
    });
    return success({ conversation });
  } catch (err: unknown) {
    routeLogger.error("PATCH error:", err);

    const statusCode = err instanceof AppError ? err.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    perfMonitor.end(statusCode, { error: true });

    if (err instanceof AppError) {
      return errorFromAppError(err);
    }

    return errorFromAppError(new AppError("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

// ------------------------------
// DELETE
// ------------------------------
export async function DELETE(req: NextRequest) {
  const perfMonitor = createPerformanceMonitor("/api/conversations", "DELETE");

  try {
    const auth = await requireUser(req);
    if (!auth.ok) {
      perfMonitor.end(auth.response.status);
      return auth.response;
    }
    const { userId } = auth;
    perfMonitor.userId = userId;

    const rawBody = await parseStrictJson(req);
    let body;
    try {
      body = deleteConversationSchema.parse(rawBody);
    } catch (e: unknown) {
      return errorFromAppError(formatZodValidationError(e));
    }

    const { id } = body;

    await deleteConversation(userId, id);
    routeLogger.info(`Deleted conversation ${id} for user: ${userId}`);

    perfMonitor.end(200, { operation: "deleteConversation", conversationId: id });
    return success({ ok: true });
  } catch (err: unknown) {
    routeLogger.error("DELETE error:", err);

    const statusCode = err instanceof AppError ? err.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    perfMonitor.end(statusCode, { error: true });

    if (err instanceof AppError) {
      return errorFromAppError(err);
    }

    return errorFromAppError(new AppError("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}

// ------------------------------
// PUT (kept for backward compatibility)
// ------------------------------
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const rawBody = await parseStrictJson(req);
    const body = (rawBody && typeof rawBody === "object" ? rawBody : {}) as { id?: string };
    const { id } = body;

    if (!id) {
      return errorFromAppError(new ValidationError("Missing id"));
    }

    const convo = await getConversation(id);
    if (!convo || convo.userId !== userId) {
      routeLogger.warn(`Conversation not found: ${id} for user: ${userId}`);
      return errorFromAppError(new NotFoundError("Conversation"));
    }

    const messagesRaw = await getMessages(id);
    const messages = sanitizeMessages(messagesRaw);

    return success({ messages });
  } catch (err: unknown) {
    routeLogger.error("PUT error:", err);

    if (err instanceof AppError) {
      return errorFromAppError(err);
    }

    return errorFromAppError(new AppError("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR));
  }
}
