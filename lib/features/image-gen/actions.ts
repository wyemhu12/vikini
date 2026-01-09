"use server";

import { ImageGenFactory } from "./core/ImageGenFactory";
import { ImageGenOptions } from "./core/types";

export async function generateImageAction(prompt: string, options?: ImageGenOptions) {
  try {
    const provider = ImageGenFactory.getProvider("gemini");
    const results = await provider.generate(prompt, options);
    return { success: true, data: results };
  } catch (error) {
    console.error("generateImageAction Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating image",
    };
  }
}
