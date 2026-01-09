import { ImageGenProvider } from "./types";
import { GeminiImageProvider } from "../providers/GeminiImageProvider";

export class ImageGenFactory {
  private static providers: Record<string, ImageGenProvider> = {};

  static getProvider(id: "gemini" | string): ImageGenProvider {
    if (!this.providers[id]) {
      switch (id) {
        case "gemini":
          this.providers[id] = new GeminiImageProvider();
          break;
        default:
          throw new Error(`Image Provider '${id}' not supported`);
      }
    }
    return this.providers[id];
  }
}
