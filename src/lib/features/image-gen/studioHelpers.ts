import type { GeneratedImage } from "@/app/features/image-gen/components/Canvas";
import type { FrontendMessage } from "@/lib/features/chat/conversationListHelpers";

export interface StudioErrorDisplay {
  message: string;
  suggestion?: string;
}

/** Classify raw error messages into user-friendly i18n messages + suggestions. */
export function classifyStudioError(
  errorMsg: string,
  t: (key: string) => string
): StudioErrorDisplay {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("safety") || lower.includes("blocked")) {
    return {
      message: t("studioErrorSafety"),
      suggestion: t("studioErrorSafetySuggestion"),
    };
  }
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many")) {
    return {
      message: t("studioErrorRateLimit"),
      suggestion: t("studioErrorRateLimitSuggestion"),
    };
  }
  if (lower.includes("content policy") || lower.includes("recitation")) {
    return {
      message: t("studioErrorContentPolicy"),
      suggestion: t("studioErrorContentPolicySuggestion"),
    };
  }
  return { message: errorMsg || t("studioGenerateFailed") };
}

/** Maps assistant image messages into reverse-chronological GeneratedImage items. */
export function mapMessagesToGeneratedImages(
  messages: readonly FrontendMessage[]
): GeneratedImage[] {
  return messages
    .filter((msg) => msg.role === "assistant" && msg.meta?.imageUrl)
    .map((msg) => {
      const meta = msg.meta!;
      const opts = meta.originalOptions || {};
      return {
        id: msg.id,
        url: meta.imageUrl!,
        prompt: meta.prompt || msg.content || "Unknown prompt",
        aspectRatio: opts.aspectRatio,
        style: opts.style,
        model: opts.model,
        enhancer: opts.enhancer,
        originalPrompt: meta.originalPrompt as string | undefined,
        enhancedPrompt: meta.enhancedPrompt as string | undefined,
        isFavorite: !!meta.is_favorite,
        parentMessageId: meta.parentMessageId as string | undefined,
        editDepth: meta.editDepth as number | undefined,
        tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : undefined,
        aiComment: meta.aiComment as string | undefined,
        storagePath:
          ((meta.attachment as Record<string, unknown> | undefined)?.storagePath as
            | string
            | undefined) || (meta.storagePath as string | undefined),
      };
    })
    .reverse();
}

export function buildFinalPrompt(prompt: string, negativePrompt: string): string {
  const trimmedNeg = negativePrompt.trim();
  return trimmedNeg ? `${prompt}\nDo NOT include: ${trimmedNeg}` : prompt;
}

export function estimateGenerationSeconds(model: string, numberOfImages: number): number {
  const perImageSec = model.includes("pro") ? 20 : model.includes("gemini") ? 12 : 15;
  return perImageSec * Math.max(1, numberOfImages);
}

export function resolveApiKeyStorageKey(model: string): {
  storageKey: string;
  provider: "OpenAI" | "Replicate" | "Gemini";
  requiresUserKey: boolean;
} {
  if (model.includes("gpt-image")) {
    return { storageKey: "vikini-openai-key", provider: "OpenAI", requiresUserKey: true };
  }
  if (model.includes("flux") || model.includes("replicate")) {
    return { storageKey: "vikini-replicate-key", provider: "Replicate", requiresUserKey: true };
  }
  return { storageKey: "vikini-gemini-key", provider: "Gemini", requiresUserKey: false };
}

export function buildVariationPrompt(originalPrompt: string): string {
  return `Create a variation of this image. Keep the same overall composition, style, and mood, but introduce subtle creative differences in details, colors, or perspective. Original description: ${originalPrompt}`;
}

export function buildGenerateImageBody(params: {
  prompt: string;
  conversationId: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  style: string;
  isEnhancerOn: boolean;
  referenceImagesBase64: string[];
  batchSize?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    conversationId: params.conversationId,
    options: {
      model: params.model,
      aspectRatio: params.aspectRatio,
      resolution: params.model.includes("gemini-3") ? params.resolution : undefined,
      style: params.style === "none" ? undefined : params.style,
      enhancer: params.isEnhancerOn,
      referenceImages:
        params.referenceImagesBase64.length > 0 ? params.referenceImagesBase64 : undefined,
    },
  };
  if (params.batchSize && params.batchSize > 1) {
    body.batchSize = params.batchSize;
  }
  return body;
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function readStoredApiKey(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

export async function postGenerateImageRequest(
  body: Record<string, unknown>,
  apiKey: string,
  fallbackError: string
): Promise<{ success?: boolean; [key: string]: unknown }> {
  const response = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as {
    success?: boolean;
    error?: { message?: string } | string;
    [key: string]: unknown;
  };
  if (!response.ok) {
    const errMsg = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(errMsg || fallbackError);
  }
  return json;
}
