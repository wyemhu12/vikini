// /app/api/conversations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireUser } from "./auth";
import { parseJsonBody } from "./validators";
import { sanitizeMessages } from "./sanitize";
import { logger } from "@/lib/utils/logger";
import { NotFoundError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { HTTP_STATUS, CONVERSATION_DEFAULTS } from "@/lib/utils/constants";

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

// ------------------------------
// GET
// - /api/conversations            => list conversations
// - /api/conversations?id=<uuid>  => get messages for conversation (client is using this)
// ------------------------------
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    // ✅ If id provided => return messages
    if (id) {
      const convo = await getConversation(id);
      if (!convo || convo.userId !== userId) {
        routeLogger.warn(`Conversation not found or access denied: ${id} for user: ${userId}`);
        return errorFromAppError(new NotFoundError("Conversation"));
      }

      const messagesRaw = await getMessages(id);
      const messages = sanitizeMessages(messagesRaw);

      return success({ messages });
    }

    // Default: list conversations
    const conversations = await getUserConversations(userId);
    return success({ conversations });
  } catch (err) {
    routeLogger.error("GET error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// CREATE
// ------------------------------
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await parseJsonBody<{ title?: string }>(req, { fallback: {} });
    const title = body?.title || CONVERSATION_DEFAULTS.TITLE;

    const conversation = await saveConversation(userId, { title });
    routeLogger.info(`Created conversation ${conversation?.id} for user: ${userId}`);

    return success({ conversation }, HTTP_STATUS.CREATED);
  } catch (err) {
    routeLogger.error("POST error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// PATCH
// - rename (existing)
// - set gemId (new): { id, gemId } (gemId can be null)
// - set model (new): { id, model }
// ------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // NOTE: keep strict parsing behavior (invalid JSON => throws => 500 as before)
    const body = await parseJsonBody(req) as { id?: string; title?: string; gemId?: string | null; model?: string | null };

    const { id, title } = body || {};
    const hasGemId = Object.prototype.hasOwnProperty.call(body || {}, "gemId");
    const gemId = body?.gemId ?? null;
    
    // ✅ NEW: Handle model field
    const hasModel = Object.prototype.hasOwnProperty.call(body || {}, "model");
    const model = body?.model ?? null;

    if (!id) {
      return errorFromAppError(new ValidationError("Missing id"));
    }

    let conversation = null;

    // IMPORTANT: không đổi title trừ khi client gửi title explicitly
    if (typeof title === "string") {
      conversation = await updateConversationTitle(userId, id, title);
    }

    if (hasGemId) {
      conversation = await setConversationGem(userId, id, gemId);
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

    return success({ conversation });
  } catch (err) {
    routeLogger.error("PATCH error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// ------------------------------
// DELETE
// ------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = await parseJsonBody(req, { fallback: {} }) as { id?: string };
    const { id } = body || {};

    if (!id) {
      return errorFromAppError(new ValidationError("Missing id"));
    }

    await deleteConversation(userId, id);
    routeLogger.info(`Deleted conversation ${id} for user: ${userId}`);
    
    return success({ ok: true });
  } catch (err) {
    routeLogger.error("DELETE error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
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

    const body = await parseJsonBody(req, { fallback: {} }) as { id?: string };
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
  } catch (err) {
    routeLogger.error("PUT error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return error("Internal error", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

