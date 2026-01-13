import OpenAI from "openai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";

export class OpenAIImageProvider implements ImageGenProvider {
  id = "openai";

  async generate(
    prompt: string,
    options: ImageGenOptions = {},
    apiKey?: string
  ): Promise<ImageGenResult[]> {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("Missing OpenAI API Key");
    }

    const openai = new OpenAI({ apiKey: key });

    // Map style/aspectRatio to prompt enhancements since DALL-E 3 doesn't support them natively as params
    let finalPrompt = prompt;
    if (options.style) {
      finalPrompt = `${prompt}, in the style of ${options.style}`;
    }

    // Map aspect ratio to DALL-E 3 supported sizes
    // 1024x1024 (Square), 1024x1792 (Portrait), 1792x1024 (Landscape)
    let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
    if (options.aspectRatio === "9:16" || options.aspectRatio === "3:4") {
      size = "1024x1792";
    } else if (options.aspectRatio === "16:9" || options.aspectRatio === "4:3") {
      size = "1792x1024";
    }

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: finalPrompt,
        size: size,
        quality: "hd", // Always go for HD
        n: 1,
      });

      const image = response.data?.[0];
      if (!image || !image.url) throw new Error("No image URL returned from OpenAI");

      return [
        {
          url: image.url,
          provider: "openai",
          metadata: {
            model: "dall-e-3",
            aspectRatio: options.aspectRatio,
            style: options.style,
            revisedPrompt: image.revised_prompt || prompt,
          },
        },
      ];
    } catch (error: any) {
      console.error("OpenAI Gen Error:", error);
      throw new Error(error.message || "Failed to generate image with OpenAI");
    }
  }
}
