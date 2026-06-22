/**
 * Image Generation Core Types
 * Defines interfaces for multi-provider image generation system
 */

export interface ImageGenOptions {
  aspectRatio?:
    | "1:1"
    | "16:9"
    | "9:16"
    | "4:3"
    | "3:4"
    | "3:2"
    | "2:3"
    | "21:9"
    | "5:4"
    | "4:5"
    | "1:4"
    | "4:1"
    | "1:8"
    | "8:1";
  resolution?: "0.5K" | "1K" | "2K" | "4K";
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
  referenceImage?: string;
  referenceImages?: string[];
}

export interface ImageGenResult {
  url: string;
  provider: string;
  aiComment?: string;
  metadata?: {
    mimeType?: string;
    [key: string]: unknown;
  };
}

export interface ImageGenProvider {
  id: string;
  generate(prompt: string, options?: ImageGenOptions, apiKey?: string): Promise<ImageGenResult[]>;
}

export interface ImageEditOptions {
  sourceImageUrl: string;
  editPrompt: string;
  model?: string;
  aspectRatio?: string;
}
