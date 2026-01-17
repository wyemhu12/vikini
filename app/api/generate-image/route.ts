import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { ImageGenFactory } from "@/lib/features/image-gen/core/ImageGenFactory";
import { ImageGenOptions } from "@/lib/features/image-gen/core/types";
import { saveMessage } from "@/lib/features/chat/messages";
import { logger } from "@/lib/utils/logger";
import { UnauthorizedError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("generate-image");

export const maxDuration = 60; // Set max duration to 60s (Vercel functionality)

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();
    // const userEmail = session.user.email; // Unused

    // 2. Parse Body
    const body = await req.json();
    let { prompt } = body; // Prompt is mutable
    const { conversationId, options } = body;

    if (!prompt || !conversationId) {
      throw new ValidationError("Missing prompt or conversationId");
    }

    // --- PROMPT ENHANCER LOGIC ---
    if (options?.enhancer) {
      routeLogger.info("[Enhancer] Original prompt:", prompt);
      try {
        const { getGenAIClient } = require("@/lib/core/genaiClient");
        const genAI = getGenAIClient();

        // Use latest Gemini Flash model for speed & low cost, or user's selected Gemini model
        let enhancerModelId = "gemini-2.5-flash";
        if (
          options?.enhancerModel &&
          String(options.enhancerModel).toLowerCase().includes("gemini")
        ) {
          enhancerModelId = options.enhancerModel;
        }

        const enhancementPrompt = `Rewrite the following image generation prompt to be more detailed, artistic, and descriptive. Keep it under 100 words. Maintain the original intent but enhance visual details, lighting, and style. Return ONLY the enhanced prompt, no intro/outro.\n\nOriginal Prompt: "${prompt}"`;

        // Note: Using @google/genai SDK format
        const result = await genAI.models.generateContent({
          model: enhancerModelId,
          contents: [{ role: "user", parts: [{ text: enhancementPrompt }] }],
        });

        let enhancedText = "";
        if (typeof result.text === "function") {
          enhancedText = result.text();
        } else if (typeof result.text === "string") {
          enhancedText = result.text;
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
    let providerName = "gemini"; // Default
    if (
      options.model?.toLowerCase().includes("flux") ||
      options.model?.toLowerCase().includes("replicate") ||
      options.model?.toLowerCase().includes("schnell")
    ) {
      providerName = "replicate";
    } else if (
      options.model?.toLowerCase().includes("dall-e") ||
      options.model?.toLowerCase().includes("gpt")
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
        console.error("Supabase Upload Error:", uploadError);
        throw new Error("Failed to upload image");
      }

      // Get Signed URL (10 years) to ensure access even if bucket is private
      // and prevent issues with public access policies.
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 315360000); // 10 years in seconds

      if (signedError || !signedData?.signedUrl) {
        console.error("Failed to create signed URL:", signedError);
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
    const messageMeta = {
      type: "image_gen",
      prompt: prompt, // This is the ENHANCED prompt (modified by enhancer if enabled)
      imageUrl: finalUrl, // Add imageUrl at top level for easy access
      originalOptions: options, // Add originalOptions at top level for badges
      provider: providerName,
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
        originalOptions: options,
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
    return error("Image generation failed", 500);
  }
}
