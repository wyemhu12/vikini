import { GoogleGenAI } from "@google/genai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";
import { logger } from "@/lib/utils/logger";

const providerLogger = logger.withContext("GeminiImageProvider");

export class GeminiImageProvider implements ImageGenProvider {
  id = "gemini";
  private modelId = "imagen-4.0-generate-001";

  async generate(
    prompt: string,
    options?: ImageGenOptions,
    apiKey?: string
  ): Promise<ImageGenResult[]> {
    // Use BYOK key if provided, otherwise fallback to server env
    const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    // Instantate client with v1alpha to access Imagen 3/4
    // NOTE: apiVersion is not in official types yet - using type assertion for alpha features
    const clientAlpha = new GoogleGenAI({
      apiKey: key,
      apiVersion: "v1alpha",
    } as Parameters<typeof GoogleGenAI>[0] & { apiVersion: string });

    providerLogger.info(`Generating with model: ${this.modelId} (Alpha Client)`);

    try {
      const finalPrompt = options?.style ? `${prompt}. Style: ${options.style}` : prompt;

      // NOTE: generateImages is an alpha feature not in official types
      const models = clientAlpha.models as typeof clientAlpha.models & {
        generateImages: (params: {
          model: string;
          prompt: string;
          config: { numberOfImages: number; aspectRatio: string };
        }) => Promise<{
          generatedImages: Array<{
            image: { imageUri?: string; imageBytes?: string; mimeType?: string };
          }>;
        }>;
      };

      const response = await models.generateImages({
        model: this.modelId,
        prompt: finalPrompt,
        config: {
          numberOfImages: options?.numberOfImages || 1,
          aspectRatio: options?.aspectRatio || "1:1",
        },
      });

      // Parse response
      if (!response || !response.generatedImages) {
        providerLogger.error("Gemini Raw Response:", response);
        throw new Error("No images returned from Gemini");
      }

      // Define the expected image structure from Gemini API
      interface GeminiImage {
        image: {
          imageUri?: string;
          imageBytes?: string;
          mimeType?: string;
        };
      }

      return response.generatedImages.map((img: GeminiImage) => ({
        url: img.image.imageUri || `data:image/png;base64,${img.image.imageBytes}`,
        provider: this.id,
        metadata: {
          mimeType: img.image.mimeType,
        },
      }));
    } catch (error) {
      providerLogger.error("Gemini Image Gen Error:", error);
      throw new Error(
        `Gemini Image Generation Failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
