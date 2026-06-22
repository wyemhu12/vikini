import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ImageGenFactory } from "@/lib/features/image-gen/core/ImageGenFactory";
import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
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
import { incrementBatchGenUsage } from "@/lib/core/batchGenQuota";

const routeLogger = logger.withContext("generate-image");

// Zod schema for image generation request validation
const imageGenOptionsSchema = z
  .object({
    aspectRatio: z
      .enum([
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4",
        "3:2",
        "2:3",
        "21:9",
        "5:4",
        "4:5",
        "1:4",
        "4:1",
        "1:8",
        "8:1",
      ])
      .optional(),
    resolution: z.enum(["0.5K", "1K", "2K", "4K"]).optional(),
    numberOfImages: z.number().int().min(1).max(4).optional(),
    style: z.string().max(50).optional(), // MT5: Any style ID from expanded style system
    enhancer: z.boolean().optional(),
    enhancerModel: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    referenceImage: z.string().optional(), // backward compat
    referenceImages: z.array(z.string()).max(4).optional(), // QW-D: multiple reference images
  })
  .optional();

const imageGenRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000, "Prompt too long"),
  conversationId: z.string().uuid("Invalid conversation ID"),
  options: imageGenOptionsSchema,
  batchSize: z.number().int().min(1).max(4).optional(),
});

export const maxDuration = 60; // Set max duration to 60s (Vercel functionality)

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 1.5 Rate Limiting (uses same window as chat, but separate bucket for image gen)
    const rl = await consumeRateLimit(`image-gen:${userId}`);
    if (!rl.allowed) {
      routeLogger.warn(`Rate limit exceeded for image generation: ${userId}`);
      throw new RateLimitError("Too many image generation requests. Please wait.");
    }

    // 2. Parse & Validate Body
    const rawBody = await req.json();
    let parsed;
    try {
      parsed = imageGenRequestSchema.parse(rawBody);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) {
        const firstIssue = e.issues[0];
        throw new ValidationError(`${firstIssue.path.join(".")}: ${firstIssue.message}`);
      }
      throw new ValidationError("Invalid request body");
    }

    let { prompt } = parsed; // Prompt is mutable
    const { conversationId, options, batchSize } = parsed;

    // 2.5 Verify conversation ownership
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
      throw new ForbiddenError("You don't have permission to add images to this conversation");
    }

    // --- PROMPT ENHANCER LOGIC ---
    const userOriginalPrompt = prompt; // QW2: Save before enhancement
    if (options?.enhancer) {
      routeLogger.info("[Enhancer] Original prompt:", prompt);
      try {
        const { getGenAIClient } = await import("@/lib/core/genaiClient");
        const genAI = getGenAIClient();

        // Use latest Gemini Flash model for speed & low cost, or user's selected Gemini model
        let enhancerModelId = "gemini-2.5-flash";
        if (
          options?.enhancerModel &&
          String(options.enhancerModel).toLowerCase().includes("gemini")
        ) {
          enhancerModelId = options.enhancerModel;
        }

        const enhancementPrompt = `You are a professional AI image prompt engineer. Enhance this prompt for maximum image quality.

Rules:
- Add specific visual details: lighting (volumetric, rim, ambient occlusion), texture, material
- Add quality keywords: 8K, ultra-detailed, masterpiece, professional photography
- Add composition cues: depth of field, rule of thirds, leading lines
- Maintain the EXACT original intent and subject — do not change what the user wants
- Keep under 150 words
- Return ONLY the enhanced prompt text, no intro, no explanation, no quotes

Original: "${prompt}"`;

        // Note: Using @google/genai SDK format
        const result = await genAI.models.generateContent({
          model: enhancerModelId,
          contents: [{ role: "user", parts: [{ text: enhancementPrompt }] }],
        });

        let enhancedText = "";
        // Try to get text from the result - handle both SDK versions
        const textValue = result.text;
        if (typeof textValue === "function") {
          enhancedText = (textValue as () => string)();
        } else if (typeof textValue === "string") {
          enhancedText = textValue;
        } else {
          enhancedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }

        if (enhancedText) {
          routeLogger.info(`[Enhancer] Enhanced prompt:`, enhancedText.trim());
          prompt = enhancedText.trim();
        }
      } catch (e) {
        routeLogger.error("Prompt Enhancement Failed, using original:", e);
      }
    }
    // -----------------------------

    // 3. Generate Image
    // Determine provider based on model override or default
    let providerName = "gemini-native"; // Default (Gemini Image Flash)
    const modelName = options?.model?.toLowerCase();

    // Auto-route to gemini-native when referenceImage(s) are provided
    if (
      options?.referenceImage ||
      (options?.referenceImages && options.referenceImages.length > 0)
    ) {
      providerName = "gemini-native";
    } else if (
      modelName?.includes("gemini-3.1-flash-image") ||
      modelName?.includes("gemini-3-pro-image") ||
      modelName?.includes("imagen")
    ) {
      providerName = "gemini-native";
    } else if (
      modelName?.includes("flux") ||
      modelName?.includes("replicate") ||
      modelName?.includes("schnell")
    ) {
      providerName = "replicate";
    } else if (
      modelName?.includes("dall-e") ||
      modelName?.includes("gpt-image") ||
      modelName?.includes("gpt")
    ) {
      providerName = "openai";
    }

    const provider = ImageGenFactory.getProvider(providerName);

    // Extract BYOK key from headers if present
    const apiKey = req.headers.get("x-api-key") || undefined;

    // Type assertion to ensure model mapping doesn't lose data
    const results = await provider.generate(prompt, options as ImageGenOptions, apiKey);

    if (!results || results.length === 0) {
      throw new Error("No images generated");
    }

    const result = results[0]; // Handle first image for now
    let finalUrl = result.url;
    let storagePath = "";
    let mimeType = "image/png";
    let buffer: Buffer | null = null;
    let filename = "";

    // 4. Upload to Supabase
    const supabase = getSupabaseAdmin();
    const bucket = "attachments";

    if (result.url.startsWith("data:image")) {
      // Decode Base64
      const parts = result.url.split(",");
      const base64Data = parts[1];
      mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/png";
      buffer = Buffer.from(base64Data, "base64");
    } else if (result.url.startsWith("http")) {
      // Fetch Remote URL (Gemini Temporary URL)
      // console.log("Fetching remote image:", result.url);
      const res = await fetch(result.url);
      if (!res.ok) throw new Error("Failed to fetch image from provider");
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = res.headers.get("content-type") || "image/png";
    }

    if (buffer) {
      const ext = mimeType.split("/")[1] || "png";
      const uuid = crypto.randomUUID();
      filename = `gen-${Date.now()}.${ext}`;
      storagePath = `${userId}/${conversationId}/${uuid}-${filename}`;

      // Upload Logic
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        routeLogger.error("Supabase Upload Error:", uploadError);
        throw new Error("Failed to upload image");
      }

      // Get Signed URL (10 years) to ensure access even if bucket is private
      // and prevent issues with public access policies.
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 315360000); // 10 years in seconds

      if (signedError || !signedData?.signedUrl) {
        routeLogger.warn("Failed to create signed URL:", signedError);
        // Fallback to public URL if signing fails (though unlikely)
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        finalUrl = publicUrl;
      } else {
        finalUrl = signedData.signedUrl;
      }
    }

    // 5. Persist as Message (Critical for persistence)
    // We create a message of role 'assistant'
    const messageContent = `Generated Image: ${prompt}`;

    // Ensure model is always present in originalOptions
    const effectiveModel =
      options?.model ||
      (providerName === "gemini" || providerName === "gemini-native"
        ? "Gemini Image Flash"
        : providerName === "openai"
          ? "GPT Image 2"
          : providerName === "replicate"
            ? "Flux"
            : "Unknown");

    const savedOptions = {
      ...options,
      model: effectiveModel,
    };

    const messageMeta = {
      type: "image_gen",
      prompt: prompt, // This is the ENHANCED prompt (modified by enhancer if enabled)
      imageUrl: finalUrl, // Add imageUrl at top level for easy access
      originalOptions: savedOptions, // Now always includes model
      provider: providerName,
      // QW2: Store both original and enhanced prompts for transparency
      originalPrompt: options?.enhancer ? userOriginalPrompt : undefined,
      enhancedPrompt: options?.enhancer ? prompt : undefined,
      // P2-1: AI comment from interleaved text+image output
      aiComment: result.aiComment,
      // MT6: Token usage from provider
      usage: result.metadata?.usage as Record<string, unknown> | undefined,
      attachment: {
        url: finalUrl,
        storagePath: storagePath,
        mimeType: mimeType,
        filename: filename,
      },
      // Keep legacy metadata for backward compatibility if needed, but optional
      metadata: {
        imageUrl: finalUrl,
        prompt: prompt,
        originalOptions: savedOptions,
      },
    };

    routeLogger.info("[Image Gen] Saving message with metadata:", {
      prompt: messageMeta.prompt,
      imageUrl: messageMeta.imageUrl,
    });

    // Save Message using existing helper
    const message = await saveMessage(
      userId, // Note: saveMessage uses userId for logging but check if it enforces RLS or ownership.
      // `messages.ts` saveMessage doesn't seem to check ownership of conversation, assumes caller checks.
      // Logic seems fine.
      conversationId,
      "assistant",
      messageContent,
      messageMeta
    );

    if (!message) {
      throw new Error("Failed to save message");
    }

    // 6. Track batch gen usage if applicable
    if (batchSize && batchSize > 1) {
      await incrementBatchGenUsage(userId, batchSize);
    }

    // 6. Skip inserting into 'attachments' table as these are generated images, not user uploads.
    // The message meta contains the reference.

    // 7. Return Success
    return success({
      message: message,
      imageUrl: finalUrl,
    });
  } catch (err: unknown) {
    routeLogger.error("Image Gen Route Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);

    // Surface safety/content-policy errors to user with specific message
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.includes("blocked by safety") ||
      errMsg.includes("content policy") ||
      errMsg.includes("blocked by Gemini")
    ) {
      return error(errMsg, 422);
    }

    return error("Image generation failed", 500);
  }
}
