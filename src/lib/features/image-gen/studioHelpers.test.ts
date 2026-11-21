import { describe, it, expect, vi, afterEach } from "vitest";
import {
  classifyStudioError,
  convertReferenceImagesToBase64,
  fetchStudioBatchQuota,
  fileToBase64,
  mapMessagesToGeneratedImages,
  buildFinalPrompt,
  estimateGenerationSeconds,
  resolveApiKeyStorageKey,
  resolveBatchFailureReason,
  requestImageVariation,
  buildVariationPrompt,
  buildGenerateImageBody,
  readStoredApiKey,
  parseImageApiResponse,
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

  it("TC-HF-05 & NP-3: convertReferenceImagesToBase64 converts blobs in order and handles FileReader failures gracefully", async () => {
    const onError = vi.fn();
    expect(await convertReferenceImagesToBase64([], onError)).toEqual([]);
    expect(onError).not.toHaveBeenCalled();

    const blobs = [
      new Blob(["abc"], { type: "text/plain" }),
      new Blob(["def"], { type: "text/plain" }),
    ];
    const encoded = await convertReferenceImagesToBase64(blobs, onError);
    expect(encoded).toHaveLength(2);
    expect(encoded[0]).toMatch(/^data:text\/plain;base64,/);
    expect(encoded[1]).toMatch(/^data:text\/plain;base64,/);
    expect(encoded[0]).not.toBe(encoded[1]);
    expect(onError).not.toHaveBeenCalled();

    // NP-3: Second FileReader fails -> invokes onError once and returns partial converted array without throwing
    let callIdx = 0;
    class StubFileReader {
      result: string | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        callIdx += 1;
        if (callIdx === 1) {
          this.result = "data:image/png;base64,AAA";
          this.onload?.();
        } else {
          this.error = new Error("Read failed");
          this.onerror?.();
        }
      }
    }
    vi.stubGlobal("FileReader", StubFileReader);
    const partial = await convertReferenceImagesToBase64(blobs, onError);
    expect(partial).toEqual(["data:image/png;base64,AAA"]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Read failed" }));
  });

  it("TC-HF-06 & NP-3: resolveBatchFailureReason returns null on partial/full success and non-null Error on total failure", () => {
    const partialResults: PromiseSettledResult<unknown>[] = [
      { status: "fulfilled", value: { success: true } },
      { status: "rejected", reason: new Error("429") },
    ];
    expect(resolveBatchFailureReason(partialResults, 1)).toBeNull();
    expect(resolveBatchFailureReason([{ status: "fulfilled", value: 1 }], 0)).toBeNull();

    const err1 = new Error("Safety blocked");
    expect(
      resolveBatchFailureReason(
        [
          { status: "rejected", reason: err1 },
          { status: "rejected", reason: new Error("Other") },
        ],
        0
      )
    ).toBe(err1);

    expect(
      resolveBatchFailureReason([{ status: "rejected", reason: "Quota 429" }], 0)?.message
    ).toBe("Quota 429");

    // NP-3: falsy rejections still yield a non-null Error(fallbackMessage)
    expect(
      resolveBatchFailureReason([{ status: "rejected", reason: undefined }], 0, "Custom fail")
        ?.message
    ).toBe("Custom fail");
    expect(
      resolveBatchFailureReason([{ status: "rejected", reason: null }], 0, "Custom fail")?.message
    ).toBe("Custom fail");
  });

  it("TC-HF-07 & NP-5: requestImageVariation handles model selection, fallback, and source image HTTP 404", async () => {
    window.localStorage.setItem("vikini-gemini-key", "gk-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["img"], { type: "image/png" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await requestImageVariation({
      imageUrl: "https://cdn.example/img.png",
      originalPrompt: "Golden sunset",
      conversationId: "conv-1",
      model: "gemini-3-pro-image",
      aspectRatio: "16:9",
    });
    expect(res).toEqual({ success: true });
    const reqInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((reqInit.headers as Record<string, string>)["x-api-key"]).toBe("gk-1");
    const body = JSON.parse(reqInit.body as string) as {
      prompt: string;
      options: { model: string; referenceImage: string };
    };
    expect(body.prompt).toContain("Original description: Golden sunset");
    expect(body.options.model).toBe("gemini-3-pro-image");
    expect(body.options.referenceImage).toMatch(/^data:/);

    // Fallback model when non-gemini-3 model is active
    const fetchFallback = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["img"], { type: "image/png" }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchFallback);
    await requestImageVariation({
      imageUrl: "https://cdn.example/img.png",
      originalPrompt: "Forest",
      conversationId: "conv-1",
      model: "flux-dev",
      aspectRatio: "1:1",
    });
    const fallbackBody = JSON.parse(fetchFallback.mock.calls[1][1].body as string) as {
      options: { model: string };
    };
    expect(fallbackBody.options.model).toBe("gemini-3.1-flash-image");

    // NP-5: HTTP 404 on source image throws before calling /api/generate-image
    const fetch404 = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch404);
    await expect(
      requestImageVariation({
        imageUrl: "https://cdn.example/missing.png",
        originalPrompt: "Missing",
        conversationId: "conv-1",
        model: "gemini-3-pro-image",
        aspectRatio: "1:1",
      })
    ).rejects.toThrow("Failed to fetch source image");
    expect(fetch404).toHaveBeenCalledTimes(1);
  });

  it("TC-HF-08 & NP-5: fetchStudioBatchQuota unwraps data envelopes and guards malformed/failed responses", async () => {
    const onError = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: true, data: { rank: "pro", maxBatchSize: 4, quotas: {} } }),
            { status: 200 }
          )
        )
    );
    expect(await fetchStudioBatchQuota(onError)).toEqual({
      rank: "pro",
      maxBatchSize: 4,
      quotas: {},
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ rank: "basic", maxBatchSize: 2, quotas: {} }), {
          status: 200,
        })
      )
    );
    expect(await fetchStudioBatchQuota(onError)).toEqual({
      rank: "basic",
      maxBatchSize: 2,
      quotas: {},
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ rank: "basic", maxBatchSize: 0, quotas: {} }), {
          status: 200,
        })
      )
    );
    expect(await fetchStudioBatchQuota(onError)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })));
    expect(await fetchStudioBatchQuota(onError)).toBeNull();
    expect(onError).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network down")));
    expect(await fetchStudioBatchQuota(onError)).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("TC-W2B-14(d): fileToBase64 rejects cleanly on FileReader.onerror without hanging", async () => {
    class FailingReaderWithError {
      error: Error | null = new Error("Disk read error");
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onerror?.();
      }
    }
    vi.stubGlobal("FileReader", FailingReaderWithError);
    await expect(fileToBase64(new Blob(["x"]))).rejects.toThrow("Disk read error");

    class FailingReaderWithoutError {
      error: Error | null = null;
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onerror?.();
      }
    }
    vi.stubGlobal("FileReader", FailingReaderWithoutError);
    await expect(fileToBase64(new Blob(["x"]))).rejects.toThrow("Failed to read file");
  });

  it("TC-IMG-01..TC-IMG-06 & NP-1..NP-2: parseImageApiResponse and classifyStudioError handle 504/502 non-JSON and timeout errors safely", async () => {
    // TC-IMG-01: 200 OK valid JSON object
    const okRes = new Response(
      JSON.stringify({ success: true, data: { imageUrl: "https://cdn.example/1.png" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    expect(await parseImageApiResponse(okRes, "Generation failed")).toEqual({
      success: true,
      data: { imageUrl: "https://cdn.example/1.png" },
    });

    // TC-IMG-02 & NP-1: 504 plain-text Vercel timeout with timeoutError
    const timeoutResWithMsg = new Response(
      "An error occurred with your deployment\nFUNCTION_INVOCATION_TIMEOUT",
      { status: 504, headers: { "Content-Type": "text/plain" } }
    );
    await expect(
      parseImageApiResponse(timeoutResWithMsg, "Generation failed", "Custom timeout")
    ).rejects.toThrow("Custom timeout");

    // TC-IMG-03: 504 plain-text without timeoutError -> includes HTTP 504, never SyntaxError
    const timeoutResNoMsg = new Response("An error occurred with your deployment", {
      status: 504,
      headers: { "Content-Type": "text/plain" },
    });
    const err504 = await parseImageApiResponse(timeoutResNoMsg, "Generation failed").catch(
      (e: unknown) => e
    );
    expect(err504).toBeInstanceOf(Error);
    expect((err504 as Error).message).toBe("Generation failed (HTTP 504)");
    expect((err504 as Error).message).not.toContain("Unexpected token");
    expect((err504 as Error).message).not.toContain("is not valid JSON");

    // TC-IMG-04: 502 HTML & 503 empty body
    await expect(
      parseImageApiResponse(
        new Response("<html>502 Bad Gateway</html>", { status: 502 }),
        "Generation failed"
      )
    ).rejects.toThrow("Generation failed (HTTP 502)");
    await expect(
      parseImageApiResponse(new Response("", { status: 503 }), "Generation failed")
    ).rejects.toThrow("Generation failed (HTTP 503)");

    // TC-IMG-05 & NP-2: 200 OK with HTML / array / null -> fail-closed fallbackError
    await expect(
      parseImageApiResponse(
        new Response("<html>Proxy</html>", { status: 200 }),
        "Generation failed"
      )
    ).rejects.toThrow("Generation failed");
    await expect(
      parseImageApiResponse(new Response("[]", { status: 200 }), "Generation failed")
    ).rejects.toThrow("Generation failed");
    await expect(
      parseImageApiResponse(new Response("null", { status: 200 }), "Generation failed")
    ).rejects.toThrow("Generation failed");

    // TC-IMG-06: 400/422 JSON error strings/objects preserved + classifyStudioError timeout branch
    await expect(
      parseImageApiResponse(
        new Response(JSON.stringify({ error: { message: "Safety blocked" } }), { status: 400 }),
        "Generation failed"
      )
    ).rejects.toThrow("Safety blocked");
    await expect(
      parseImageApiResponse(
        new Response(JSON.stringify({ error: "Custom string" }), { status: 422 }),
        "Generation failed"
      )
    ).rejects.toThrow("Custom string");

    expect(classifyStudioError("Generation failed (HTTP 504)", identityT)).toEqual({
      message: "studioErrorTimeout",
      suggestion: "studioErrorTimeoutSuggestion",
    });
    expect(classifyStudioError("Task timed out after 60 seconds", identityT)).toEqual({
      message: "studioErrorTimeout",
      suggestion: "studioErrorTimeoutSuggestion",
    });
    expect(classifyStudioError("502 Bad Gateway", identityT)).toEqual({
      message: "studioErrorTimeout",
      suggestion: "studioErrorTimeoutSuggestion",
    });

    // NP-1 via postGenerateImageRequest end-to-end
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("An error occurred with your deployment...", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        })
      )
    );
    await expect(
      postGenerateImageRequest({ prompt: "dragon" }, "k", "Generation failed")
    ).rejects.toThrow("Generation failed (HTTP 504)");
  });
});
