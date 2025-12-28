// /app/api/conversations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "./auth";
import { parseJsonBody, createConversationSchema, updateConversationSchema, deleteConversationSchema } from "./validators";
import { sanitizeMessages } from "./sanitize";
import { logger } from "@/lib/utils/logger";
import { NotFoundError, ValidationError, AppError } from "@/lib/utils/errors";
import { errorFromAppError } from "@/lib/utils/apiResponse";
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

      // Backward compatibility: return direct format instead of wrapped in { success, data }
      return NextResponse.json(
        { messages },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Default: list conversations
    const conversations = await getUserConversations(userId);
    // Backward compatibility: return direct format instead of wrapped in { success, data }
    return NextResponse.json(
      { conversations },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    routeLogger.error("GET error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
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

    const rawBody = await parseJsonBody(req, { fallback: {} });
    const body = createConversationSchema.parse(rawBody);
    const title = body.title || CONVERSATION_DEFAULTS.TITLE;

    const conversation = await saveConversation(userId, { title });
    routeLogger.info(`Created conversation ${conversation?.id} for user: ${userId}`);

    // Backward compatibility: return direct format instead of wrapped in { success, data }
    return NextResponse.json(
      { conversation },
      { 
        status: HTTP_STATUS.CREATED,
        headers: { "Cache-Control": "no-store" } 
      }
    );
  } catch (err) {
    routeLogger.error("POST error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
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
    const rawBody = await parseJsonBody(req);
    let body;
    try {
      body = updateConversationSchema.parse(rawBody);
    } catch (e) {
      const error = e as { errors?: Array<{ path: string[]; message: string }>; message?: string };
      if (error.errors) {
        const firstError = error.errors[0];
        const field = firstError.path.join(".");
        return errorFromAppError(new ValidationError(`${field}: ${firstError.message}`));
      }
      return errorFromAppError(new ValidationError(error?.message || "Invalid request body"));
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

    // Backward compatibility: return direct format instead of wrapped in { success, data }
    return NextResponse.json(
      { conversation },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    routeLogger.error("PATCH error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
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

    const rawBody = await parseJsonBody(req, { fallback: {} });
    let body;
    try {
      body = deleteConversationSchema.parse(rawBody);
    } catch (e) {
      const error = e as { errors?: Array<{ path: string[]; message: string }>; message?: string };
      if (error.errors) {
        const firstError = error.errors[0];
        const field = firstError.path.join(".");
        return errorFromAppError(new ValidationError(`${field}: ${firstError.message}`));
      }
      return errorFromAppError(new ValidationError(error?.message || "Invalid request body"));
    }

    const { id } = body;

    await deleteConversation(userId, id);
    routeLogger.info(`Deleted conversation ${id} for user: ${userId}`);
    
    // Backward compatibility: return direct format
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    routeLogger.error("DELETE error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
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

    // Backward compatibility: return direct format instead of wrapped in { success, data }
    return NextResponse.json(
      { messages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    routeLogger.error("PUT error:", err);
    
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    
    return NextResponse.json(
      { error: "Internal error" },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

