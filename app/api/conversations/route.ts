// /app/api/conversations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
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
  updateConversationTitle,
  deleteConversation,
  setConversationGem,
  setConversationModel,
} from "@/lib/features/chat/conversations";
import { getMessages } from "@/lib/features/chat/messages";

const routeLogger = logger.withContext("/api/conversations");

// Type guard for Zod-like validation errors
interface ZodLikeError {
  errors?: Array<{ path: string[]; message: string }>;
  message?: string;
}

function isZodLikeError(e: unknown): e is ZodLikeError {
  return typeof e === "object" && e !== null && ("errors" in e || "message" in e);
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

    // ✅ If id provided => return messages
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

    const rawBody = await parseJsonBody(req, { fallback: {} });
    const body = createConversationSchema.parse(rawBody);
    const title = body.title || CONVERSATION_DEFAULTS.TITLE;
    const model = body.model;

    const conversation = await saveConversation(userId, { title, model });
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

    // NOTE: keep strict parsing behavior (invalid JSON => throws => 500 as before)
    const rawBody = await parseJsonBody(req);
    let body;
    try {
      body = updateConversationSchema.parse(rawBody);
    } catch (e: unknown) {
      if (isZodLikeError(e) && e.errors) {
        const firstError = e.errors[0];
        const field = firstError.path.join(".");
        return errorFromAppError(new ValidationError(`${field}: ${firstError.message}`));
      }
      const message = isZodLikeError(e) ? e.message : "Invalid request body";
      return errorFromAppError(new ValidationError(message || "Invalid request body"));
    }

    const { id, title, gemId, model } = body;
    const hasGemId = Object.prototype.hasOwnProperty.call(rawBody, "gemId");
    const hasModel = Object.prototype.hasOwnProperty.call(rawBody, "model");

    let conversation = null;

    // IMPORTANT: không đổi title trừ khi client gửi title explicitly
    if (typeof title === "string") {
      conversation = await updateConversationTitle(userId, id, title);
    }

    if (hasGemId) {
      conversation = await setConversationGem(userId, id, gemId ?? null);
    }

    // ✅ NEW: Handle model update
    if (hasModel && model) {
      conversation = await setConversationModel(userId, id, model);
    }

    // fallback: return current
    if (!conversation) {
      const c = await getConversation(id);
      if (!c || c.userId !== userId) {
        routeLogger.warn(`Conversation not found: ${id} for user: ${userId}`);
        return errorFromAppError(new NotFoundError("Conversation"));
      }
      conversation = c;
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

    const rawBody = await parseJsonBody(req, { fallback: {} });
    let body;
    try {
      body = deleteConversationSchema.parse(rawBody);
    } catch (e: unknown) {
      if (isZodLikeError(e) && e.errors) {
        const firstError = e.errors[0];
        const field = firstError.path.join(".");
        return errorFromAppError(new ValidationError(`${field}: ${firstError.message}`));
      }
      const message = isZodLikeError(e) ? e.message : "Invalid request body";
      return errorFromAppError(new ValidationError(message || "Invalid request body"));
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

    const body = (await parseJsonBody(req, { fallback: {} })) as { id?: string };
    const { id } = body || {};

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
