import { GoogleGenAI } from "@google/genai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";
import { logger } from "@/lib/utils/logger";

const providerLogger = logger.withContext("GeminiNativeImageProvider");

/**
 * Gemini Native Image Provider — uses generateContent API
 * for Nano Banana models (gemini-3.1-flash-image-preview, gemini-3-pro-image-preview).
 *
 * Unlike Imagen (generateImages alpha API), these models use the standard
 * generateContent endpoint with `responseModalities: ['Image']`.
 *
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
export class GeminiNativeImageProvider implements ImageGenProvider {
  id = "gemini-native";

  async generate(
    prompt: string,
    options?: ImageGenOptions,
    apiKey?: string
  ): Promise<ImageGenResult[]> {
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    const ai = new GoogleGenAI({ apiKey: key });

    // Default to Nano Banana 2 (3.1 Flash Image) if no model specified
    const modelId = options?.model || "gemini-3.1-flash-image-preview";

    providerLogger.info(`Generating with model: ${modelId} (Native Image Gen)`);

    try {
      const finalPrompt =
        options?.style && options.style !== "none" ? `${prompt}. Style: ${options.style}` : prompt;

      // Build config with responseModalities and imageConfig
      const config: Record<string, unknown> = {
        responseModalities: ["Image"],
      };

      // Aspect ratio via imageConfig (supported by gemini-3.1-flash-image-preview and gemini-3-pro-image-preview)
      if (options?.aspectRatio) {
        config.imageConfig = {
          aspectRatio: options.aspectRatio,
        };
      }

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
        config,
      });

      // Parse response — scan parts for inlineData (base64 images)
      const candidates = (response as { candidates?: unknown[] })?.candidates;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        providerLogger.error("No candidates in response:", response);
        throw new Error("No image generated from Gemini");
      }

      const candidate = candidates[0] as { content?: { parts?: unknown[] } };
      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        providerLogger.error("No parts in response:", response);
        throw new Error("No image parts in Gemini response");
      }

      const results: ImageGenResult[] = [];

      for (const part of parts) {
        const p = part as {
          inlineData?: { data: string; mimeType: string };
          text?: string;
        };

        if (p.inlineData?.data) {
          const mimeType = p.inlineData.mimeType || "image/png";
          results.push({
            url: `data:${mimeType};base64,${p.inlineData.data}`,
            provider: this.id,
            metadata: { mimeType },
          });
        }
      }

      if (results.length === 0) {
        throw new Error("Gemini returned response but no image data found in parts");
      }

      return results;
    } catch (error) {
      providerLogger.error("Gemini Native Image Gen Error:", error);
      throw new Error(
        `Gemini Image Generation Failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
