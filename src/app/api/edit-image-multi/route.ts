import { NextRequest } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { saveMessage } from "@/lib/features/chat/messages";
import { logger } from "@/lib/utils/logger";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import {
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  AppError,
} from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

import { getUserProfile } from "@/lib/core/limits";
import { ALLOWED_IMAGE_MIME_TYPES } from "@/lib/core/ssrfGuard.server";
import { validateAndAuthorizeStoragePath } from "@/lib/features/chat/storageValidation";
import { HTTP_STATUS, ALLOWED_EDIT_IMAGE_MODELS } from "@/lib/utils/constants";

const routeLogger = logger.withContext("edit-image-multi");
const MAX_BASE64_IMAGE_CHARS = 14_000_000; // ~10MB decoded binary
const MAX_DECODED_IMAGE_BYTES = 10 * 1024 * 1024;
const DATA_IMAGE_URI_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

/** Schema for a single edit turn */
const editTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().optional(),
  storagePath: z.string().max(500).optional(),
  imageUrl: z.string().optional(),
  imageBase64: z
    .string()
    .max(MAX_BASE64_IMAGE_CHARS, "Image payload exceeds 10MB limit")
    .refine((val) => {
      if (!/^data:/i.test(val)) return true;
      const match = DATA_IMAGE_URI_REGEX.exec(val);
      return Boolean(match && ALLOWED_IMAGE_MIME_TYPES.has(match[1].toLowerCase()));
    }, "Unsupported or malformed data URI image format")
    .optional(),
  imageMimeType: z
    .string()
    .refine(
      (val) => ALLOWED_IMAGE_MIME_TYPES.has(val.trim().toLowerCase()),
      "Unsupported image MIME type"
    )
    .optional(),
  // Gemini multi-turn requires thought_signature for image parts from model responses
  thoughtSignature: z.string().optional(),
});

const editImageMultiSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  /** The full edit history - alternating user/model turns */
  editHistory: z.array(editTurnSchema).min(1).max(20),
  /** ID of the source (parent) message being edited */
  parentMessageId: z.string().uuid().optional(),
  options: z
    .object({
      model: z.enum(ALLOWED_EDIT_IMAGE_MODELS).optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
    })
    .optional(),
});

export const maxDuration = 300;

/**
 * Build Gemini contents[] array from edit history.
 * Uses sliding window: keep first turn (original image) + last N turns
 * to stay within Gemini's ~14 image limit per request.
 * Resolves images from Supabase storage when storagePath is provided (API-04 / B-2, M-4).
 */
async function buildGeminiContents(
  editHistory: z.infer<typeof editTurnSchema>[],
  userId: string,
  conversationId: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<Array<{ role: string; parts: Array<Record<string, unknown>> }>> {
  const MAX_IMAGE_TURNS = 3; // Keep at most 3 image-bearing turns

  async function resolveImageRaw(
    turn: z.infer<typeof editTurnSchema>
  ): Promise<{ data: string; mimeType: string }> {
    const normalizedExplicitMime = turn.imageMimeType?.trim().toLowerCase();
    if (turn.storagePath) {
      await validateAndAuthorizeStoragePath(supabase, userId, conversationId, turn.storagePath);
      const { data, error } = await supabase.storage.from("attachments").download(turn.storagePath);
      if (error || !data) {
        throw new AppError("Failed to retrieve image from storage", 422, "IMAGE_NOT_FOUND");
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      return {
        data: buffer.toString("base64"),
        mimeType: normalizedExplicitMime || "image/png",
      };
    }
    if (turn.imageBase64) {
      let rawBase64 = turn.imageBase64;
      let dataUriMime: string | undefined;
      if (/^data:/i.test(turn.imageBase64)) {
        const match = DATA_IMAGE_URI_REGEX.exec(turn.imageBase64);
        if (!match || !ALLOWED_IMAGE_MIME_TYPES.has(match[1].toLowerCase())) {
          throw new ValidationError("Unsupported or malformed data URI image format");
        }
        dataUriMime = match[1].toLowerCase();
        rawBase64 = match[2];
      }
      if (Buffer.from(rawBase64, "base64").byteLength > MAX_DECODED_IMAGE_BYTES) {
        throw new ValidationError("Image payload exceeds 10MB limit");
      }
      return {
        data: rawBase64,
        mimeType: normalizedExplicitMime || dataUriMime || "image/png",
      };
    }
    throw new AppError("Missing image data for turn", 422, "MISSING_IMAGE_DATA");
  }

  // Check if this is the first edit (no model responses yet)
  const hasModelResponse = editHistory.some((t) => t.role === "model" && t.thoughtSignature);

  if (!hasModelResponse) {
    // First edit: merge source image (turn 0) + edit text (last user turn)
    // into a single user content to avoid needing thought_signature
    const sourceTurn = editHistory[0]; // user turn with source image
    const lastUserTurn = editHistory[editHistory.length - 1]; // user turn with edit text

    const parts: Array<Record<string, unknown>> = [];

    // Add source image
    const resolved = await resolveImageRaw(sourceTurn);
    parts.push({
      inlineData: {
        data: resolved.data,
        mimeType: resolved.mimeType,
      },
    });

    // Add edit instruction
    const editText = lastUserTurn?.text || sourceTurn?.text || "Edit this image";
    parts.push({ text: editText });

    return [{ role: "user", parts }];
  }

  // Subsequent edits: use proper multi-turn with thought_signatures
  // Count model image turns for sliding window
  const modelImageTurns = editHistory.filter(
    (t) => t.role === "model" && (t.storagePath || t.imageBase64)
  );

  let filteredHistory = editHistory;
  if (modelImageTurns.length > MAX_IMAGE_TURNS) {
    // Keep first user turn (source image) + last N turn pairs without adjacent same-role turns
    const firstUserTurn = editHistory[0];
    let recentTurns = editHistory.slice(-(MAX_IMAGE_TURNS * 2));
    while (recentTurns.length > 0 && recentTurns[0].role === firstUserTurn.role) {
      recentTurns = recentTurns.slice(1);
    }
    filteredHistory = [firstUserTurn, ...recentTurns];
  }

  // Resolve images in parallel across filtered turns to avoid sequential Storage latency
  const results = await Promise.all(
    filteredHistory.map(async (turn) => {
      const parts: Array<Record<string, unknown>> = [];

      if (turn.storagePath || turn.imageBase64) {
        const resolved = await resolveImageRaw(turn);
        const imagePart: Record<string, unknown> = {
          inlineData: {
            data: resolved.data,
            mimeType: resolved.mimeType,
          },
        };
        // Include thoughtSignature for model image parts (required by Gemini multi-turn)
        if (turn.thoughtSignature) {
          imagePart.thoughtSignature = turn.thoughtSignature;
        }
        parts.push(imagePart);
      }

      if (turn.text) {
        parts.push({ text: turn.text });
      }

      // Ensure at least one part
      if (parts.length === 0) {
        parts.push({ text: " " });
      }

      return { role: turn.role, parts };
    })
  );

  return results;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 2. Rate limit
    const rl = await consumeRateLimit(`image-edit:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for multi-turn edit: ${userId}`);
      throw new RateLimitError("Too many edit requests. Please wait.");
    }

    // 3. Parse & validate
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    let parsed;
    try {
      parsed = editImageMultiSchema.parse(rawBody);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const { conversationId, editHistory, parentMessageId, options } = parsed;

    // 4. Verify conversation ownership
    const supabase = getSupabaseAdmin();
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new NotFoundError("Conversation");
    }
    if (conversation.user_id !== userId) {
      throw new ForbiddenError("You don't have permission to edit images in this conversation");
    }

    // 4.5 Gatekeeper check (M-19, M-23)
    const profile = await getUserProfile(userId);
    if (!profile) {
      throw new AppError(
        "Service unavailable",
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "SERVICE_UNAVAILABLE"
      );
    }
    if (profile.is_blocked) {
      throw new AppError("User is blocked", 403, "USER_BLOCKED");
    }
    if (profile.rank === "not_whitelisted") {
      throw new AppError("Access pending approval", 403, "ACCESS_PENDING");
    }

    // 5. Build Gemini contents
    const contents = await buildGeminiContents(editHistory, userId, conversationId, supabase);
    routeLogger.info(
      `Multi-turn edit: ${contents.length} turns, model: ${options?.model || "default"}`
    );

    // 6. Call Gemini
    const apiKey =
      req.headers.get("x-api-key") ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    const ai = new GoogleGenAI({ apiKey });
    const modelId = options?.model || "gemini-3.1-flash-image";

    const config: Record<string, unknown> = {
      responseModalities: ["Image"],
    };

    if (options?.aspectRatio) {
      config.imageConfig = { aspectRatio: options.aspectRatio };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents,
      config,
    });

    // 7. Parse response
    const candidates = (response as { candidates?: unknown[] })?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      // Check promptFeedback.blockReason when candidates are omitted due to safety filtering
      const blockReason = (response as { promptFeedback?: { blockReason?: string } })
        ?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new ValidationError(
          "Image was blocked by safety filters. Try rephrasing your edit instruction."
        );
      }
      routeLogger.error("No candidates in multi-turn edit response");
      throw new Error("No edited image generated from Gemini");
    }

    const candidate = candidates[0] as {
      content?: { parts?: unknown[] };
      finishReason?: string;
    };

    if (candidate.finishReason === "IMAGE_SAFETY" || candidate.finishReason === "SAFETY") {
      throw new ValidationError(
        "Image was blocked by safety filters. Try rephrasing your edit instruction."
      );
    }

    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new Error("No image parts in Gemini edit response");
    }

    let resultBase64 = "";
    let resultMimeType = "image/png";
    let resultThoughtSignature: string | undefined;

    for (const part of parts) {
      const p = part as {
        inlineData?: { data: string; mimeType: string };
        thoughtSignature?: string;
        thought_signature?: string;
      };
      if (p.inlineData?.data) {
        resultBase64 = p.inlineData.data;
        resultMimeType = p.inlineData.mimeType || "image/png";
      }
      // Capture thoughtSignature (camelCase SDK field with snake_case fallback)
      const sig = p.thoughtSignature ?? p.thought_signature;
      if (sig) {
        resultThoughtSignature = sig;
      }
    }

    if (!resultBase64) {
      throw new Error("Gemini returned edit response but no image data found");
    }

    // 8. Upload to Supabase storage
    const bucket = "attachments";
    const resultBuffer = Buffer.from(resultBase64, "base64");
    const ext = resultMimeType.split("/")[1] || "png";
    const uuid = crypto.randomUUID();
    const filename = `edit-multi-${Date.now()}.${ext}`;
    const storagePath = `${userId}/${conversationId}/${uuid}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, resultBuffer, {
        contentType: resultMimeType,
        upsert: false,
      });

    if (uploadError) {
      routeLogger.error("Upload Error:", uploadError);
      throw new Error("Failed to upload edited image");
    }

    // 9. Get signed URL
    let finalUrl: string;
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 315360000);

    if (signedError || !signedData?.signedUrl) {
      routeLogger.warn("Failed to create signed URL:", signedError);
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      finalUrl = publicUrl;
    } else {
      finalUrl = signedData.signedUrl;
    }

    // 10. Extract the latest user prompt for message content
    const lastUserTurn = [...editHistory].reverse().find((t) => t.role === "user");
    const editPrompt = lastUserTurn?.text || "Multi-turn edit";

    // 11. Save message
    const messageContent = `Edited Image: ${editPrompt}`;
    const editDepth = editHistory.filter((t) => t.role === "model").length + 1;

    const messageMeta = {
      type: "image_edit",
      editPrompt,
      imageUrl: finalUrl,
      parentMessageId: parentMessageId || undefined,
      editDepth,
      turnCount: editHistory.length,
      originalOptions: {
        ...options,
        model: modelId,
      },
      attachment: {
        url: finalUrl,
        storagePath,
        mimeType: resultMimeType,
        filename,
      },
    };

    let message;
    try {
      message = await saveMessage(userId, conversationId, "assistant", messageContent, messageMeta);
      if (!message) {
        throw new Error("Failed to save message");
      }
    } catch (saveErr: unknown) {
      await supabase.storage
        .from(bucket)
        .remove([storagePath])
        .catch((cleanupErr: unknown) => {
          routeLogger.warn("Failed to cleanup orphan multi-edit image:", cleanupErr);
        });
      throw saveErr;
    }

    // 12. Return with storagePath so EditPanel can use it for next turn (M-4, m-7, m-12)
    return success({
      message,
      imageUrl: finalUrl,
      storagePath,
      imageMimeType: resultMimeType,
      thoughtSignature: resultThoughtSignature,
    });
  } catch (err: unknown) {
    routeLogger.error("Multi-Turn Edit Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    const message = err instanceof Error ? err.message : "Image editing failed";
    return error(message, 500);
  }
}
