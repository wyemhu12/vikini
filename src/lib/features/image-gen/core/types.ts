export interface ImageGenOptions {
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  numberOfImages?: number; // Default 1
  style?:
    | "none"
    | "photorealistic"
    | "sketch"
    | "cartoon"
    | "digital_art"
    | "anime"
    | "digital-art"
    | "cinematic"
    | "3d-render";
  // Enhancer options
  enhancer?: boolean;
  enhancerModel?: string;
  // Model selection
  model?: string;
}

export interface ImageGenResult {
  url: string; // URL or Base64 data URI
  provider: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenProvider {
  id: string; // e.g., 'gemini', 'openai'

  /**
   * Generates images based on the provided prompt and options.
   * @param prompt The text description for the image.
   * @param options Configuration options for generation.
   * @param apiKey Optional API key (BYOK) to override server env.
   * @returns Array of generated image results.
   */
  generate(prompt: string, options?: ImageGenOptions, apiKey?: string): Promise<ImageGenResult[]>;
}
