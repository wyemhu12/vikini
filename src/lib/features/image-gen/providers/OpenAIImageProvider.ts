import OpenAI from "openai";
import { ImageGenProvider, ImageGenOptions, ImageGenResult } from "../core/types";
import { logger } from "@/lib/utils/logger";

const imageGenLogger = logger.withContext("image-gen");

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

    // MT5: Map style to detailed prompt enhancement
    let finalPrompt = prompt;
    if (options.style && options.style !== "none") {
      const { getStyleInstruction } = await import("../stylePrompts");
      const styleConfig = getStyleInstruction(options.style);
      finalPrompt = styleConfig
        ? `${prompt}. ${styleConfig.shortAppend}`
        : `${prompt}, in the style of ${options.style}`;
    }

    // Map aspect ratio to GPT Image 2 supported sizes
    // 1024x1024 (Square), 1024x1536 (Portrait), 1536x1024 (Landscape)
    let size: "1024x1024" | "1024x1536" | "1536x1024" | "auto" = "1024x1024";
    if (options.aspectRatio === "9:16" || options.aspectRatio === "3:4") {
      size = "1024x1536";
    } else if (options.aspectRatio === "16:9" || options.aspectRatio === "4:3") {
      size = "1536x1024";
    }

    try {
      const response = await openai.images.generate({
        model: "gpt-image-2",
        prompt: finalPrompt,
        size: size,
        quality: "high",
        n: 1,
      });

      // GPT Image 2 returns b64_json by default
      const image = response.data?.[0];
      if (!image) throw new Error("No image returned from OpenAI");

      // Handle both b64_json and URL responses
      let url: string;
      if (image.b64_json) {
        url = `data:image/png;base64,${image.b64_json}`;
      } else if (image.url) {
        url = image.url;
      } else {
        throw new Error("No image data returned from OpenAI");
      }

      return [
        {
          url,
          provider: "openai",
          metadata: {
            model: "gpt-image-2",
            aspectRatio: options.aspectRatio,
            style: options.style,
            revisedPrompt: image.revised_prompt || prompt,
          },
        },
      ];
    } catch (error: unknown) {
      imageGenLogger.error("OpenAI Gen Error:", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message || "Failed to generate image with OpenAI");
    }
  }
}
