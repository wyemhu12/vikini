import { GoogleGenAI } from "@google/genai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";
import { logger } from "@/lib/utils/logger";

const providerLogger = logger.withContext("GeminiNativeImageProvider");

/**
 * Gemini Native Image Provider — uses generateContent API
 * for Nano Banana models (gemini-3.1-flash-image, gemini-3-pro-image).
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
    const modelId = options?.model || "gemini-3.1-flash-image";

    providerLogger.info(`Generating with model: ${modelId} (Native Image Gen)`);

    try {
      // MT5: Use detailed style instructions instead of simple append
      let finalPrompt = prompt;
      let styleSystemInstruction: string | undefined;
      if (options?.style && options.style !== "none") {
        const { getStyleInstruction } = await import("../stylePrompts");
        const styleConfig = getStyleInstruction(options.style);
        if (styleConfig) {
          styleSystemInstruction = styleConfig.instruction;
        } else {
          // Fallback for unknown styles
          finalPrompt = `${prompt}. Style: ${options.style}`;
        }
      }

      // Build config with responseModalities, imageConfig, and safetySettings to disable filters
      const config: Record<string, unknown> = {
        responseModalities: ["TEXT", "IMAGE"],
        safetySettings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        ],
      };

      // Aspect ratio & resolution via imageConfig (supported by gemini-3.1-flash-image and gemini-3-pro-image)
      const imageConfig: Record<string, unknown> = {};
      if (options?.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;
      if (options?.resolution) imageConfig.resolution = options.resolution;
      if (Object.keys(imageConfig).length > 0) {
        config.imageConfig = imageConfig;
      }

      // Build contents with optional reference image(s)
      // Supports both single referenceImage (backward compat) and referenceImages array
      let contentParts: Array<
        { text: string } | { inlineData: { data: string; mimeType: string } }
      >;

      const referenceImageSources =
        options?.referenceImages || (options?.referenceImage ? [options.referenceImage] : []);

      if (referenceImageSources.length > 0) {
        contentParts = [];
        for (const refImg of referenceImageSources) {
          const dataUrlMatch = refImg.match(/^data:([\w/+.-]+);base64,(.+)$/);
          if (dataUrlMatch) {
            contentParts.push({ inlineData: { data: dataUrlMatch[2], mimeType: dataUrlMatch[1] } });
          } else {
            providerLogger.warn("Invalid referenceImage data URL format, skipping");
          }
        }
        contentParts.push({ text: finalPrompt });
        // If no valid images were parsed, fall back to text-only
        if (contentParts.length === 1) {
          providerLogger.warn("No valid reference images parsed, using text-only prompt");
        }
      } else {
        contentParts = [{ text: finalPrompt }];
      }

      // MT5: Add style system instruction if available
      if (styleSystemInstruction) {
        config.systemInstruction = styleSystemInstruction;
      }

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts: contentParts }],
        config,
      });

      // Parse response — scan parts for inlineData (base64 images)
      const candidates = (response as { candidates?: unknown[] })?.candidates;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        providerLogger.error("No candidates in response:", response);
        throw new Error("No image generated from Gemini");
      }

      const candidate = candidates[0] as {
        content?: { parts?: unknown[] };
        finishReason?: string;
      };

      // Check finishReason for safety or other blocking reasons
      const frValue =
        candidate?.finishReason || (candidate as Record<string, unknown>)?.finish_reason;
      const finishReason = frValue ? String(frValue).toUpperCase() : "";

      if (
        finishReason &&
        finishReason !== "STOP" &&
        finishReason !== "MAX_TOKENS" &&
        finishReason !== "UNDEFINED"
      ) {
        providerLogger.warn(`Gemini blocked image generation. finishReason: ${finishReason}`);

        if (finishReason.includes("SAFETY") || finishReason === "IMAGE_SAFETY") {
          throw new Error(
            "Image generation was blocked by safety filters. Try rephrasing your prompt — avoid brand names, celebrities, or potentially sensitive content."
          );
        }
        if (finishReason === "RECITATION") {
          throw new Error(
            "Image generation was blocked due to content policy (recitation). Try a more original or creative prompt."
          );
        }
        // Generic blocked reason
        throw new Error(
          `Image generation was blocked by Gemini (reason: ${finishReason}). Try modifying your prompt.`
        );
      }

      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts) || parts.length === 0) {
        providerLogger.error("No parts in response:", response);
        throw new Error("No image parts in Gemini response");
      }

      const results: ImageGenResult[] = [];
      let aiComment = "";

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
        if (p.text) {
          aiComment += p.text + "\n";
        }
      }

      // Attach AI comment to each result if present
      if (aiComment.trim()) {
        results.forEach((r) => {
          r.aiComment = aiComment.trim();
        });
      }

      if (results.length === 0) {
        throw new Error("Gemini returned response but no image data found in parts");
      }

      // MT6: Extract usage metadata
      const usageMetadata = (response as unknown as Record<string, unknown>)?.usageMetadata as
        | Record<string, unknown>
        | undefined;
      if (usageMetadata) {
        const usage = {
          promptTokenCount: usageMetadata.promptTokenCount as number | undefined,
          candidatesTokenCount: usageMetadata.candidatesTokenCount as number | undefined,
          totalTokenCount: usageMetadata.totalTokenCount as number | undefined,
        };
        // Attach usage to all results
        for (const result of results) {
          if (!result.metadata) result.metadata = {};
          result.metadata.usage = usage;
        }
        providerLogger.info(`Token usage: ${JSON.stringify(usage)}`);
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
