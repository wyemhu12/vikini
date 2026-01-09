import { GoogleGenAI } from "@google/genai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";

export class GeminiImageProvider implements ImageGenProvider {
  id = "gemini";
  private modelId = "imagen-4.0-generate-001";

  async generate(prompt: string, options?: ImageGenOptions): Promise<ImageGenResult[]> {
    // Use local client with v1alpha for Imagen support
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    // Instantate client with v1alpha to access Imagen 3/4
    // FIX: The property name is 'apiVersion', not 'version'
    const clientAlpha = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" } as any);

    console.log(`[GeminiImageProvider] Generating with model: ${this.modelId} (Alpha Client)`);

    try {
      const finalPrompt = options?.style ? `${prompt}. Style: ${options.style}` : prompt;

      const response = await (clientAlpha.models as any).generateImages({
        model: this.modelId,
        prompt: finalPrompt,
        config: {
          numberOfImages: options?.numberOfImages || 1,
          aspectRatio: options?.aspectRatio || "1:1",
        },
      });

      // Parse response
      if (!response || !response.generatedImages) {
        console.error("Gemini Raw Response:", response);
        throw new Error("No images returned from Gemini");
      }

      return response.generatedImages.map((img: any) => ({
        url: img.image.imageUri || `data:image/png;base64,${img.image.imageBytes}`,
        provider: this.id,
        metadata: {
          mimeType: img.image.mimeType,
        },
      }));
    } catch (error) {
      console.error("Gemini Image Gen Error:", error);
      throw new Error(
        `Gemini Image Generation Failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
