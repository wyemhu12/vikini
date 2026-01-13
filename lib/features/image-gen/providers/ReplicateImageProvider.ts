import Replicate from "replicate";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";
import { logger } from "@/lib/utils/logger";

const providerLogger = logger.withContext("ReplicateImageProvider");

export class ReplicateImageProvider implements ImageGenProvider {
  id = "replicate";
  private defaultModel = "black-forest-labs/flux-schnell"; // Fast & Cheap/Free-tier friendly

  async generate(
    prompt: string,
    options?: ImageGenOptions,
    apiKey?: string
  ): Promise<ImageGenResult[]> {
    const key = apiKey || process.env.REPLICATE_API_TOKEN || "";

    if (!key) {
      throw new Error("Missing Replicate API Key. Please add it in Settings.");
    }

    const replicate = new Replicate({
      auth: key,
    });

    providerLogger.info(`Generating with model: ${this.defaultModel}`);

    try {
      // Add style to prompt if provided
      const finalPrompt = options?.style ? `${prompt}. Style: ${options.style}` : prompt;

      const output = await replicate.run(this.defaultModel as any, {
        input: {
          prompt: finalPrompt,
          aspect_ratio: options?.aspectRatio || "1:1", // Flux supports aspect_ratio directly usually, but we set w/h to be safe or use its mapping if supported
          // num_outputs: options?.numberOfImages || 1, // Schnell often limited to 1-4
          go_fast: true,
          megapixels: "1",
          num_inference_steps: 4,
        },
      });

      // Replicate returns array of URLs (usually) or a single URL depending on model
      const urls: string[] = Array.isArray(output)
        ? (output as unknown as string[])
        : [output as unknown as string];

      return urls.map((url) => ({
        url,
        provider: "replicate",
      }));
    } catch (error: any) {
      providerLogger.error("Generation Error:", error);
      throw new Error(`Replicate Error: ${error.message}`);
    }
  }
}
