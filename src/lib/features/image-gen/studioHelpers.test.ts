import { describe, it, expect, vi, afterEach } from "vitest";
import { STUDIO_REF_IMAGE_MAX_BYTES } from "@/lib/features/files/uploadPresentation";
import {
  ReferenceImageUploadError,
  classifyStudioError,
  fetchStudioBatchQuota,
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
  uploadReferenceImages,
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
      batchSize: 4,
    });
    expect(batchBody.batchSize).toBe(4);
    const batchOpts = batchBody.options as Record<string, unknown>;
    expect(batchOpts.resolution).toBe("2K");
    expect(batchOpts.style).toBeUndefined();
    expect("referenceImage" in batchOpts).toBe(false);
    expect("referenceImages" in batchOpts).toBe(false);
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

  it("TC-CLEAN-01, WP-CLEAN-01 & NP-CLEAN-01: requestImageVariation uses 4-step Direct Upload, normalizes MIME, guards size, and classifies 40MB error", async () => {
    window.localStorage.setItem("vikini-gemini-key", "gk-1");

    const build4StepFetch = (
      sourceRes: Response,
      storagePath = "u/conv-1/ref-11111111-2222-3333-4444-555555555555.png"
    ) =>
      vi
        .fn()
        .mockResolvedValueOnce(sourceRes)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                uploads: [{ signedUrl: "https://proj.supabase.co/u/var-1", storagePath }],
              },
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    // WP-CLEAN-01: 4-step happy path
    const fetchOk = build4StepFetch(
      new Response(new Blob(["img"], { type: "image/png" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchOk);

    const res = await requestImageVariation({
      imageUrl: "https://cdn.example/img.png",
      originalPrompt: "Golden sunset",
      conversationId: "conv-1",
      model: "gemini-3-pro-image",
      aspectRatio: "16:9",
    });

    expect(res).toEqual({ success: true });
    expect(fetchOk).toHaveBeenCalledTimes(4);
    expect(fetchOk.mock.calls[0][0]).toBe("https://cdn.example/img.png");
    expect(fetchOk.mock.calls[1][0]).toBe("/api/generate-image/reference-upload-url");
    expect(JSON.parse(fetchOk.mock.calls[1][1].body as string)).toEqual({
      conversationId: "conv-1",
      files: [{ filename: "variation.png", mimeType: "image/png", sizeBytes: 3 }],
    });
    expect(fetchOk.mock.calls[2][0]).toBe("https://proj.supabase.co/u/var-1");
    expect(fetchOk.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/png", "x-upsert": "false" },
        body: expect.any(File),
      })
    );
    const reqInit = fetchOk.mock.calls[3][1] as RequestInit;
    expect((reqInit.headers as Record<string, string>)["x-api-key"]).toBe("gk-1");
    const body = JSON.parse(reqInit.body as string) as {
      prompt: string;
      options: Record<string, unknown>;
    };
    expect(body.prompt).toContain("Original description: Golden sunset");
    expect(body.options.model).toBe("gemini-3-pro-image");
    expect(body.options.aspectRatio).toBe("16:9");
    expect(body.options.referenceImagePaths).toEqual([
      "u/conv-1/ref-11111111-2222-3333-4444-555555555555.png",
    ]);
    expect("referenceImage" in body.options).toBe(false);
    expect("referenceImages" in body.options).toBe(false);

    // Non-gemini-3 model falls back to gemini-3.1-flash-image via 4-step upload
    const fetchFallback = build4StepFetch(
      new Response(new Blob(["img"], { type: "image/png" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchFallback);
    await requestImageVariation({
      imageUrl: "https://cdn.example/img.png",
      originalPrompt: "Forest",
      conversationId: "conv-1",
      model: "flux-dev",
      aspectRatio: "1:1",
    });
    const fallbackBody = JSON.parse(fetchFallback.mock.calls[3][1].body as string) as {
      options: { model: string };
    };
    expect(fallbackBody.options.model).toBe("gemini-3.1-flash-image");

    // MIME normalization matrix (jpg/pjpeg, x-png, webp+charset, header fallback gif, unknown/prototype -> png)
    const mimeCases: Array<{
      blobType: string;
      headerType?: string;
      expectedMime: string;
      expectedFile: string;
    }> = [
      { blobType: "image/jpg", expectedMime: "image/jpeg", expectedFile: "variation.jpg" },
      { blobType: "image/pjpeg", expectedMime: "image/jpeg", expectedFile: "variation.jpg" },
      { blobType: "image/x-png", expectedMime: "image/png", expectedFile: "variation.png" },
      {
        blobType: "IMAGE/WEBP; charset=utf-8",
        expectedMime: "image/webp",
        expectedFile: "variation.webp",
      },
      {
        blobType: "",
        headerType: "image/gif",
        expectedMime: "image/gif",
        expectedFile: "variation.gif",
      },
      {
        blobType: "application/octet-stream",
        expectedMime: "image/png",
        expectedFile: "variation.png",
      },
      { blobType: "constructor", expectedMime: "image/png", expectedFile: "variation.png" },
      { blobType: "toString", expectedMime: "image/png", expectedFile: "variation.png" },
    ];

    for (const c of mimeCases) {
      const fakeBlob = new Blob(["img"], { type: c.blobType });
      const resStub = {
        ok: true,
        headers: new Headers(c.headerType ? { "content-type": c.headerType } : {}),
        blob: vi.fn().mockResolvedValue(fakeBlob),
      } as unknown as Response;
      const mimeFetch = build4StepFetch(resStub);
      vi.stubGlobal("fetch", mimeFetch);

      await requestImageVariation({
        imageUrl: "https://cdn.example/test",
        originalPrompt: "Test",
        conversationId: "conv-1",
        model: "gemini-3.1-flash-image",
        aspectRatio: "1:1",
      });
      const signPayload = JSON.parse(mimeFetch.mock.calls[1][1].body as string) as {
        files: Array<{ filename: string; mimeType: string }>;
      };
      expect(signPayload.files[0]).toMatchObject({
        filename: c.expectedFile,
        mimeType: c.expectedMime,
      });
    }

    // Bilingual 40MB classification
    expect(classifyStudioError("Reference image exceeds 40MB limit", identityT)).toEqual({
      message: "studioRefFileTooLarge",
    });

    // NP-CLEAN-01 (1): HTTP 404 on source image throws before sign/generate
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

    // NP-CLEAN-01 (2): Empty blob (size 0) throws before sign/generate
    const fetchEmpty = vi.fn().mockResolvedValueOnce(new Response(new Blob([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchEmpty);
    await expect(
      requestImageVariation({
        imageUrl: "https://cdn.example/empty.png",
        originalPrompt: "Empty",
        conversationId: "conv-1",
        model: "gemini-3-pro-image",
        aspectRatio: "1:1",
      })
    ).rejects.toThrow("Failed to fetch source image");
    expect(fetchEmpty).toHaveBeenCalledTimes(1);

    // NP-CLEAN-01 (3): Source blob > 40MB throws ReferenceImageUploadError before sign/generate
    const oversizedBlob = new Blob(["x"], { type: "image/png" });
    Object.defineProperty(oversizedBlob, "size", { value: STUDIO_REF_IMAGE_MAX_BYTES + 1 });
    const fetchHuge = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      blob: vi.fn().mockResolvedValue(oversizedBlob),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchHuge);
    await expect(
      requestImageVariation({
        imageUrl: "https://cdn.example/huge.png",
        originalPrompt: "Huge",
        conversationId: "conv-1",
        model: "gemini-3-pro-image",
        aspectRatio: "1:1",
      })
    ).rejects.toThrow(ReferenceImageUploadError);
    expect(fetchHuge).toHaveBeenCalledTimes(1);

    // NP-CLEAN-01 (4): PUT returns 413 -> throws ReferenceImageUploadError without calling /api/generate-image
    const fetchPut413 = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(["img"], { type: "image/png" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploads: [
                { signedUrl: "https://proj.supabase.co/u/v", storagePath: "u/c/ref-1.png" },
              ],
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 413 }));
    vi.stubGlobal("fetch", fetchPut413);
    await expect(
      requestImageVariation({
        imageUrl: "https://cdn.example/img.png",
        originalPrompt: "Too big on storage",
        conversationId: "conv-1",
        model: "gemini-3-pro-image",
        aspectRatio: "1:1",
      })
    ).rejects.toThrow(ReferenceImageUploadError);
    expect(fetchPut413).toHaveBeenCalledTimes(3);
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

  it("TC-REF-10: uploadReferenceImages signs a batch in 1 request, PUTs each file directly, and throws ReferenceImageUploadError on failure", async () => {
    expect(await uploadReferenceImages([], "conv-1")).toEqual([]);

    const f1 = new File(["img1"], "a.png", { type: "image/png" });
    const f2 = new File(["img2"], "b.webp", { type: "image/webp" });

    // Happy path: 1 sign POST + 2 direct PUT calls
    const fetchOk = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploads: [
                { signedUrl: "https://proj.supabase.co/u/1", storagePath: "u/c/ref-1.png" },
                { signedUrl: "https://proj.supabase.co/u/2", storagePath: "u/c/ref-2.webp" },
              ],
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchOk);

    const paths = await uploadReferenceImages([f1, f2], "conv-1", "Upload failed");
    expect(paths).toEqual(["u/c/ref-1.png", "u/c/ref-2.webp"]);
    expect(fetchOk).toHaveBeenCalledTimes(3);
    expect(fetchOk.mock.calls[0][0]).toBe("/api/generate-image/reference-upload-url");
    expect(fetchOk.mock.calls[1][0]).toBe("https://proj.supabase.co/u/1");
    expect(fetchOk.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/png", "x-upsert": "false" },
        body: f1,
      })
    );
    expect(fetchOk.mock.calls[2][0]).toBe("https://proj.supabase.co/u/2");

    // buildGenerateImageBody attaches referenceImagePaths and leaves referenceImages undefined
    const body = buildGenerateImageBody({
      prompt: "Upscale",
      conversationId: "conv-1",
      model: "gemini-3.1-flash-image",
      aspectRatio: "1:1",
      resolution: "4K",
      style: "none",
      isEnhancerOn: false,
      referenceImagePaths: paths,
    });
    const bodyOpts = body.options as Record<string, unknown>;
    expect(bodyOpts.referenceImagePaths).toEqual(paths);
    expect(bodyOpts.referenceImages).toBeUndefined();

    // Error path 1: Sign API returns HTTP 400
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "Too large" } }), { status: 400 })
        )
    );
    await expect(uploadReferenceImages([f1], "conv-1", "Upload failed")).rejects.toBeInstanceOf(
      ReferenceImageUploadError
    );

    // Error path 2: Direct PUT returns HTTP 413
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                uploads: [
                  { signedUrl: "https://proj.supabase.co/u/1", storagePath: "u/c/ref-1.png" },
                ],
              },
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 413 }))
    );
    await expect(uploadReferenceImages([f1], "conv-1", "Upload failed")).rejects.toBeInstanceOf(
      ReferenceImageUploadError
    );

    // Error path 3: Malformed response (missing uploads array)
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
        )
    );
    await expect(uploadReferenceImages([f1], "conv-1", "Upload failed")).rejects.toBeInstanceOf(
      ReferenceImageUploadError
    );
  });
});
