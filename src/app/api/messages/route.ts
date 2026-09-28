// /app/api/messages/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { upsertMessage } from "@/lib/features/chat/messages";
import { success, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";
import { HTTP_STATUS } from "@/lib/utils/constants";

const routeLogger = logger.withContext("/api/messages");

const postMessageSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.literal("assistant"),
  content: z.string().min(1),
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
    })
    .passthrough()
    .optional(),
});

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
    const message = err instanceof Error ? err.message : "Unknown error";
    routeLogger.error("Failed to sync partial message:", message);
    return error("Failed to save message", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
