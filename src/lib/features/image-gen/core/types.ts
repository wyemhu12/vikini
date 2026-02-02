/**
 * Image Generation Core Types
 * Defines interfaces for multi-provider image generation system
 */

export interface ImageGenOptions {
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  numberOfImages?: number;
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
  enhancer?: boolean;
  enhancerModel?: string;
  model?: string;
}

export interface ImageGenResult {
  url: string;
  provider: string;
  metadata?: {
    mimeType?: string;
    [key: string]: unknown;
  };
}

export interface ImageGenProvider {
  id: string;
  generate(prompt: string, options?: ImageGenOptions, apiKey?: string): Promise<ImageGenResult[]>;
}
