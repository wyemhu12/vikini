import { describe, it, expect, vi, afterEach } from "vitest";
import {
  classifyStudioError,
  mapMessagesToGeneratedImages,
  buildFinalPrompt,
  estimateGenerationSeconds,
  resolveApiKeyStorageKey,
  buildVariationPrompt,
  buildGenerateImageBody,
  readStoredApiKey,
  postGenerateImageRequest,
} from "./studioHelpers";
import type { FrontendMessage } from "@/lib/features/chat/conversationListHelpers";

const identityT = (key: string) => key;

describe("studioHelpers (CT-6C-02)", () => {
  it("classifies safety, rate limit, content policy, and fallback errors", () => {
    expect(classifyStudioError("Blocked by safety filters", identityT)).toEqual({
      message: "studioErrorSafety",
      suggestion: "studioErrorSafetySuggestion",
    });
    expect(classifyStudioError("HTTP 429 rate limit exceeded", identityT)).toEqual({
      message: "studioErrorRateLimit",
      suggestion: "studioErrorRateLimitSuggestion",
    });
    expect(classifyStudioError("Content policy recitation", identityT)).toEqual({
      message: "studioErrorContentPolicy",
      suggestion: "studioErrorContentPolicySuggestion",
    });
    expect(classifyStudioError("Custom error", identityT)).toEqual({ message: "Custom error" });
    expect(classifyStudioError("", identityT)).toEqual({ message: "studioGenerateFailed" });
  });

  it("maps assistant image messages in reverse chronological order", () => {
    const messages: FrontendMessage[] = [
      { id: "m1", role: "user", content: "prompt 1" },
      {
        id: "m2",
        role: "assistant",
        content: "caption 1",
        meta: {
          imageUrl: "https://example.com/1.png",
          prompt: "sunset",
          is_favorite: true,
          originalOptions: { model: "gemini-3.1-flash-image", aspectRatio: "1:1" },
          attachment: { storagePath: "u/1.png" },
        },
      },
      {
        id: "m3",
        role: "assistant",
        content: "caption 2",
        meta: {
          imageUrl: "https://example.com/2.png",
          storagePath: "u/2.png",
        },
      },
    ];

    const result = mapMessagesToGeneratedImages(messages);
    expect(result.map((i) => i.id)).toEqual(["m3", "m2"]);
    expect(result[0].prompt).toBe("caption 2");
    expect(result[0].storagePath).toBe("u/2.png");
    expect(result[1].isFavorite).toBe(true);
    expect(result[1].storagePath).toBe("u/1.png");
  });

  it("builds prompts, estimates durations, resolves storage keys, and constructs request body", () => {
    expect(buildFinalPrompt("A cat", "")).toBe("A cat");
    expect(buildFinalPrompt("A cat", "  blurry ")).toBe("A cat\nDo NOT include: blurry");

    expect(estimateGenerationSeconds("gemini-3-pro-image", 2)).toBe(40);
    expect(estimateGenerationSeconds("gemini-3.1-flash-image", 1)).toBe(12);
    expect(estimateGenerationSeconds("flux-dev", 3)).toBe(45);

    expect(resolveApiKeyStorageKey("gpt-image-1")).toEqual({
      storageKey: "vikini-openai-key",
      provider: "OpenAI",
      requiresUserKey: true,
    });
    expect(resolveApiKeyStorageKey("flux-schnell")).toEqual({
      storageKey: "vikini-replicate-key",
      provider: "Replicate",
      requiresUserKey: true,
    });
    expect(resolveApiKeyStorageKey("gemini-3.1-flash-image")).toEqual({
      storageKey: "vikini-gemini-key",
      provider: "Gemini",
      requiresUserKey: false,
    });

    expect(buildVariationPrompt("Sunset")).toContain("Original description: Sunset");

    const batchBody = buildGenerateImageBody({
      prompt: "Sunset",
      conversationId: "c1",
      model: "gemini-3.1-flash-image",
      aspectRatio: "16:9",
      resolution: "2K",
      style: "none",
      isEnhancerOn: true,
      referenceImagesBase64: [],
      batchSize: 4,
    });
    expect(batchBody.batchSize).toBe(4);
    expect((batchBody.options as Record<string, unknown>).resolution).toBe("2K");
    expect((batchBody.options as Record<string, unknown>).style).toBeUndefined();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("readStoredApiKey and postGenerateImageRequest handle storage and HTTP success/errors", async () => {
    window.localStorage.setItem("vikini-gemini-key", "test-key");
    expect(readStoredApiKey("vikini-gemini-key")).toBe("test-key");
    expect(readStoredApiKey("missing-key")).toBe("");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    );
    expect(await postGenerateImageRequest({ prompt: "cat" }, "k", "fallback")).toEqual({
      success: true,
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "Safety blocked" } }), { status: 400 })
        )
    );
    await expect(postGenerateImageRequest({ prompt: "bad" }, "k", "fallback")).rejects.toThrow(
      "Safety blocked"
    );
  });
});
