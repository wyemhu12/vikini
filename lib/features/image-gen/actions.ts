"use server";

import { ImageGenOptions } from "./core/types";

export async function generateImageAction(
  _prompt: string,
  _options?: ImageGenOptions,
  _conversationId?: string
) {
  throw new Error("Deprecated. Use /api/generate-image instead.");
}
