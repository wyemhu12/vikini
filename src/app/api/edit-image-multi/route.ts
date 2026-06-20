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

const routeLogger = logger.withContext("edit-image-multi");

/** Schema for a single edit turn */
const editTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
  // Gemini multi-turn requires thought_signature for image parts from model responses
  thoughtSignature: z.string().optional(),
});

const editImageMultiSchema = z.object({
  conversationId: z.string().uuid("Invalid conversation ID"),
  /** The full edit history — alternating user/model turns */
  editHistory: z.array(editTurnSchema).min(1).max(20),
  /** ID of the source (parent) message being edited */
  parentMessageId: z.string().uuid().optional(),
  options: z
    .object({
      model: z.string().max(100).optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
    })
    .optional(),
});

export const maxDuration = 60;

/**
 * Build Gemini contents[] array from edit history.
 * Uses sliding window: keep first turn (original image) + last N turns
 * to stay within Gemini's ~14 image limit per request.
 */
function buildGeminiContents(
  editHistory: z.infer<typeof editTurnSchema>[]
): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
  const MAX_IMAGE_TURNS = 3; // Keep at most 3 image-bearing turns

  // Check if this is the first edit (no model responses yet)
  const hasModelResponse = editHistory.some((t) => t.role === "model" && t.thoughtSignature);

  if (!hasModelResponse) {
    // First edit: merge source image (turn 0) + edit text (last user turn)
    // into a single user content to avoid needing thought_signature
    const sourceTurn = editHistory[0]; // user turn with source image
    const lastUserTurn = editHistory[editHistory.length - 1]; // user turn with edit text

    const parts: Array<Record<string, unknown>> = [];

    // Add source image
    if (sourceTurn?.imageBase64) {
      const raw = sourceTurn.imageBase64.replace(/^data:[^;]+;base64,/, "");
      parts.push({
        inlineData: {
          data: raw,
          mimeType: sourceTurn.imageMimeType || "image/png",
        },
      });
    }

    // Add edit instruction
    const editText = lastUserTurn?.text || sourceTurn?.text || "Edit this image";
    parts.push({ text: editText });

    return [{ role: "user", parts }];
  }

  // Subsequent edits: use proper multi-turn with thought_signatures
  // Count model image turns for sliding window
  const modelImageTurns = editHistory.filter((t) => t.role === "model" && t.imageBase64);

  let filteredHistory = editHistory;
  if (modelImageTurns.length > MAX_IMAGE_TURNS) {
    // Keep first user turn (source image) + last N turn pairs
    const firstUserTurn = editHistory[0];
    const recentTurns = editHistory.slice(-(MAX_IMAGE_TURNS * 2));
    filteredHistory = [firstUserTurn, ...recentTurns];
  }

  return filteredHistory.map((turn) => {
    const parts: Array<Record<string, unknown>> = [];

    if (turn.imageBase64) {
      const raw = turn.imageBase64.replace(/^data:[^;]+;base64,/, "");
      const imagePart: Record<string, unknown> = {
        inlineData: {
          data: raw,
          mimeType: turn.imageMimeType || "image/png",
        },
      };
      // Include thought_signature for model image parts (required by Gemini multi-turn)
      if (turn.thoughtSignature) {
        imagePart.thought_signature = turn.thoughtSignature;
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
  });
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
    const rawBody = await req.json();
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

    // 5. Build Gemini contents
    const contents = buildGeminiContents(editHistory);
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
      // Check for safety block
      const candidate = (candidates as Array<{ finishReason?: string }>)?.[0];
      if (candidate?.finishReason === "IMAGE_SAFETY" || candidate?.finishReason === "SAFETY") {
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
        thought_signature?: string;
      };
      if (p.inlineData?.data) {
        resultBase64 = p.inlineData.data;
        resultMimeType = p.inlineData.mimeType || "image/png";
      }
      // Capture thought_signature from any part (usually alongside image)
      if (p.thought_signature) {
        resultThoughtSignature = p.thought_signature;
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

    const message = await saveMessage(
      userId,
      conversationId,
      "assistant",
      messageContent,
      messageMeta
    );

    if (!message) {
      throw new Error("Failed to save message");
    }

    // 12. Return with the base64 so EditPanel can use it for next turn
    return success({
      message,
      imageUrl: finalUrl,
      imageBase64: resultBase64,
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
