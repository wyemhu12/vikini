import { ImageGenProvider } from "./types";
import { GeminiImageProvider } from "../providers/GeminiImageProvider";
import { GeminiNativeImageProvider } from "../providers/GeminiNativeImageProvider";
import { ReplicateImageProvider } from "../providers/ReplicateImageProvider";
import { OpenAIImageProvider } from "../providers/OpenAIImageProvider";

export class ImageGenFactory {
  private static providers: Record<string, ImageGenProvider> = {};

  static getProvider(
    id: "gemini" | "gemini-native" | "replicate" | "openai" | string
  ): ImageGenProvider {
    if (!this.providers[id]) {
      switch (id) {
        case "gemini":
          this.providers[id] = new GeminiImageProvider();
          break;
        case "gemini-native":
          this.providers[id] = new GeminiNativeImageProvider();
          break;
        case "replicate":
          this.providers[id] = new ReplicateImageProvider();
          break;
        case "openai":
          this.providers[id] = new OpenAIImageProvider();
          break;
        default:
          throw new Error(`Image Provider '${id}' not supported`);
      }
    }
    return this.providers[id];
  }
}
