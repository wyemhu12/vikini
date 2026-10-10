// /app/api/messages/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { upsertMessage } from "@/lib/features/chat/messages";
import { assertConversationOwner } from "@/lib/features/chat/conversations";
import { success, error, errorFromAppError } from "@/lib/utils/apiResponse";
import { AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { HTTP_STATUS } from "@/lib/utils/constants";

const routeLogger = logger.withContext("/api/messages");

const postMessageSchema = z
  .object({
    conversationId: z.string().uuid(),
    role: z.literal("assistant"),
    content: z.string(),
    clientMessageId: z.string().min(1),
    meta: z
      .object({
        isPartial: z.boolean().optional(),
        aborted: z.boolean().optional(),
        status: z.enum(["aborted", "error", "complete"]).optional(),
        model: z.string().optional(),
        sources: z.array(z.record(z.string(), z.unknown())).optional(),
        urlContext: z.array(z.record(z.string(), z.unknown())).optional(),
        clientMessageId: z.string().optional(),
        reasoning: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .refine(
    (data) => {
      // Content can be empty if and only if meta.reasoning is a non-empty string (M-6)
      if (data.content.trim().length > 0) return true;
      const reasoning = data.meta?.reasoning;
      return typeof reasoning === "string" && reasoning.trim().length > 0;
    },
    {
      message: "content must not be empty unless meta.reasoning contains text",
      path: ["content"],
    }
  );

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return error("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    }
    const userId = session.user.email.toLowerCase();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON", HTTP_STATUS.BAD_REQUEST, "INVALID_JSON");
    }

    const parsed = postMessageSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        `Validation failed: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        HTTP_STATUS.BAD_REQUEST,
        "VALIDATION_ERROR"
      );
    }

    const { conversationId, role, content, clientMessageId, meta } = parsed.data;

    // Verify conversation ownership before saving/upserting (SEC-01 / M-15, m-23)
    await assertConversationOwner(conversationId, userId);

    const result = await upsertMessage(
      userId,
      conversationId,
      role,
      content,
      {
        ...(meta || {}),
        clientMessageId,
      },
      clientMessageId
    );

    return success({
      message: result.message,
      alreadyComplete: result.alreadyComplete ?? false,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return errorFromAppError(err);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    routeLogger.error("Failed to sync partial message:", message);
    return error("Failed to save message", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
