import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Studio | Vikini",
  description:
    "AI-powered image generation studio. Create stunning images with Gemini, GPT Image, and Flux models using text prompts, style presets, and reference images.",
};

export default function ImagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
