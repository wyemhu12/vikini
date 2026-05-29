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

const routeLogger = logger.withContext("edit-image");

const editImageRequestSchema = z.object({
  sourceImageUrl: z.string().url("Invalid source image URL"),
  editPrompt: z.string().min(1, "Edit prompt is required").max(2000, "Edit prompt too long"),
  conversationId: z.string().uuid("Invalid conversation ID"),
  options: z
    .object({
      model: z.string().max(100).optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
    })
    .optional(),
});

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 2. Rate Limiting
    const rl = await consumeRateLimit(`image-edit:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for image edit: ${userId}`);
      throw new RateLimitError("Too many image edit requests. Please wait.");
    }

    // 3. Parse & Validate Body
    const rawBody = await req.json();
    let parsed;
    try {
      parsed = editImageRequestSchema.parse(rawBody);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    const { sourceImageUrl, editPrompt, conversationId, options } = parsed;

    // 4. Verify conversation ownership
    const supabaseCheck = getSupabaseAdmin();
    const { data: conversation, error: convError } = await supabaseCheck
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

    // 5. Download source image and convert to base64
    routeLogger.info("Downloading source image for editing...");
    const imageResponse = await fetch(sourceImageUrl);
    if (!imageResponse.ok) {
      throw new ValidationError("Failed to download source image");
    }

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);
    const sourceMimeType = imageResponse.headers.get("content-type") || "image/png";
    const base64Data = imageBuffer.toString("base64");

    // 6. Call Gemini for image editing
    const apiKey =
      req.headers.get("x-api-key") ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    const ai = new GoogleGenAI({ apiKey });
    const modelId = options?.model || "gemini-3.1-flash-image-preview";

    routeLogger.info(`Editing image with model: ${modelId}`);

    const config: Record<string, unknown> = {
      responseModalities: ["Image"],
    };

    if (options?.aspectRatio) {
      config.imageConfig = {
        aspectRatio: options.aspectRatio,
      };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType: sourceMimeType } },
            { text: editPrompt },
          ],
        },
      ],
      config,
    });

    // 7. Parse response for generated image
    const candidates = (response as { candidates?: unknown[] })?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      routeLogger.error("No candidates in edit response:", response);
      throw new Error("No edited image generated from Gemini");
    }

    const candidate = candidates[0] as { content?: { parts?: unknown[] } };
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      routeLogger.error("No parts in edit response:", response);
      throw new Error("No image parts in Gemini edit response");
    }

    let resultBase64 = "";
    let resultMimeType = "image/png";

    for (const part of parts) {
      const p = part as {
        inlineData?: { data: string; mimeType: string };
        text?: string;
      };
      if (p.inlineData?.data) {
        resultBase64 = p.inlineData.data;
        resultMimeType = p.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!resultBase64) {
      throw new Error("Gemini returned edit response but no image data found");
    }

    // 8. Upload result to Supabase storage
    const supabase = getSupabaseAdmin();
    const bucket = "attachments";
    const resultBuffer = Buffer.from(resultBase64, "base64");

    const ext = resultMimeType.split("/")[1] || "png";
    const uuid = crypto.randomUUID();
    const filename = `edit-${Date.now()}.${ext}`;
    const storagePath = `${userId}/${conversationId}/${uuid}-${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, resultBuffer, {
        contentType: resultMimeType,
        upsert: false,
      });

    if (uploadError) {
      routeLogger.error("Supabase Upload Error:", uploadError);
      throw new Error("Failed to upload edited image");
    }

    // Get signed URL (10 years)
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

    // 9. Save as message
    const messageContent = `Edited Image: ${editPrompt}`;
    const messageMeta = {
      type: "image_edit",
      sourceImageId: sourceImageUrl,
      editPrompt,
      imageUrl: finalUrl,
      originalOptions: {
        ...options,
        model: options?.model || modelId,
      },
      attachment: {
        url: finalUrl,
        storagePath,
        mimeType: resultMimeType,
        filename,
      },
    };

    routeLogger.info("[Image Edit] Saving message with metadata:", {
      editPrompt: messageMeta.editPrompt,
      imageUrl: messageMeta.imageUrl,
    });

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

    // 10. Return Success
    return success({
      message,
      imageUrl: finalUrl,
    });
  } catch (err: unknown) {
    routeLogger.error("Image Edit Route Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Image editing failed", 500);
  }
}
