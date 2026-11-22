// /app/features/image-gen/components/hooks/useImageStudioActions.test.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedImage } from "../Canvas";
import { useImageStudioActions } from "./useImageStudioActions";
import type { UseImageStudioActionsParams } from "./imageStudioTypes";

const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
const mockToastError = vi.fn();
const mockPostGenerateImageRequest = vi.fn();
const mockRequestImageVariation = vi.fn();
const mockUploadReferenceImages = vi.fn();

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/features/image-gen/studioHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/image-gen/studioHelpers")>();
  return {
    ...actual,
    postGenerateImageRequest: (...args: unknown[]) => mockPostGenerateImageRequest(...args),
    requestImageVariation: (...args: unknown[]) => mockRequestImageVariation(...args),
    uploadReferenceImages: (...args: unknown[]) => mockUploadReferenceImages(...args),
    readStoredApiKey: () => "test-key",
  };
});

function buildParams(
  overrides: Partial<UseImageStudioActionsParams> = {}
): UseImageStudioActionsParams {
  return {
    prompt: "A futuristic skyline at dusk",
    negativePrompt: "",
    model: "gemini-3.1-flash-image",
    aspectRatio: "1:1",
    resolution: "1K",
    style: "none",
    isEnhancerOn: false,
    numberOfImages: 1,
    referenceImages: [],
    generating: false,
    showDeleteConfirm: null,
    selectedConversationId: "conv-1",
    language: "vi",
    t: (key: string) => key,
    createConversation: vi.fn(async () => ({
      id: "conv-new",
      title: "Studio",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    loadConversation: vi.fn(async () => undefined),
    refreshConversations: vi.fn(async () => undefined),
    setSelectedConversationId: vi.fn(),
    setGenerating: vi.fn(),
    setGeneratingLabel: vi.fn(),
    setMobileTab: vi.fn(),
    setShowApiKeyWarning: vi.fn(),
    setShowError: vi.fn(),
    setShowDeleteConfirm: vi.fn(),
    setBatchQuota: vi.fn(),
    addToPromptHistory: vi.fn(),
    ...overrides,
  };
}

describe("useImageStudioActions (TC-W2B-14 / NP-5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLoggerError.mockReset();
    mockLoggerWarn.mockReset();
    mockToastError.mockReset();
    mockPostGenerateImageRequest.mockReset();
    mockRequestImageVariation.mockReset();
    mockUploadReferenceImages.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("blocks same-tick double-click handleGenerate and cleans up the single interval", async () => {
    let resolveGen!: (val: { success: boolean }) => void;
    mockPostGenerateImageRequest.mockImplementation(
      () =>
        new Promise((res) => {
          resolveGen = res;
        })
    );
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const params = buildParams();
    const { result } = renderHook(() => useImageStudioActions(params));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.handleGenerate();
      p2 = result.current.handleGenerate();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveGen({ success: true });
      await Promise.all([p1, p2]);
    });

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(params.setGenerating).toHaveBeenLastCalledWith(false);
    expect(params.setGeneratingLabel).toHaveBeenLastCalledWith(null);
  });

  it("releases generatingRef when createConversation returns null or throws (no deadlock)", async () => {
    const createConversation = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce({
        id: "conv-3",
        title: "Project 3",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    mockPostGenerateImageRequest.mockResolvedValue({ success: true });

    const params = buildParams({
      selectedConversationId: null,
      createConversation,
    });
    const { result } = renderHook(() => useImageStudioActions(params));

    // Attempt 1: returns null -> releases lock
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(params.setShowError).toHaveBeenCalledWith({ message: "studioCreateProjectFailed" });
    expect(mockPostGenerateImageRequest).not.toHaveBeenCalled();

    // Attempt 2: rejects -> logs error & releases lock
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Gen Error:", expect.any(Error));
    expect(mockPostGenerateImageRequest).not.toHaveBeenCalled();

    // Attempt 3: succeeds cleanly (proving zero deadlock)
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(params.setSelectedConversationId).toHaveBeenCalledWith("conv-3");
    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(1);
  });

  it("releases generatingRef on handleVariation failure and guards double-trigger", async () => {
    mockRequestImageVariation
      .mockRejectedValueOnce(new Error("Failed to fetch source image"))
      .mockResolvedValueOnce({ success: true });

    const params = buildParams();
    const { result } = renderHook(() => useImageStudioActions(params));
    const img: GeneratedImage = {
      id: "img-1",
      url: "https://cdn.example/1.png",
      prompt: "Sunset",
    };

    await act(async () => {
      await result.current.handleVariation(img);
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Variation Error:", expect.any(Error));
    expect(params.setShowError).toHaveBeenCalledWith({ message: "Failed to fetch source image" });

    // Second call succeeds without deadlock
    await act(async () => {
      await result.current.handleVariation(img);
    });
    expect(mockRequestImageVariation).toHaveBeenCalledTimes(2);
    expect(params.loadConversation).toHaveBeenCalledWith("conv-1");
  });

  it("logs and shows bilingual toast.error when delete or favorite returns HTTP 500", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const params = buildParams({ showDeleteConfirm: "msg-1" });
    const { result } = renderHook(() => useImageStudioActions(params));

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Delete error:", expect.any(Error));
    expect(mockToastError).toHaveBeenCalledWith("studioDeleteFailed");
    expect(params.loadConversation).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleToggleFavorite({
        id: "msg-1",
        url: "https://cdn.example/1.png",
        prompt: "Sunset",
      });
    });
    expect(mockLoggerError).toHaveBeenCalledWith("Favorite toggle error:", expect.any(Error));
    expect(mockToastError).toHaveBeenCalledWith("studioFavoriteFailed");
  });

  it("does not update generating state after unmount while still clearing interval", async () => {
    let resolveGen!: (val: { success: boolean }) => void;
    mockPostGenerateImageRequest.mockImplementation(
      () =>
        new Promise((res) => {
          resolveGen = res;
        })
    );

    const params = buildParams();
    const { result, unmount } = renderHook(() => useImageStudioActions(params));

    let genPromise!: Promise<void>;
    act(() => {
      genPromise = result.current.handleGenerate();
    });

    await act(async () => {
      await Promise.resolve();
    });

    (params.setGenerating as ReturnType<typeof vi.fn>).mockClear();
    (params.setGeneratingLabel as ReturnType<typeof vi.fn>).mockClear();

    unmount();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(params.setGeneratingLabel).not.toHaveBeenCalled();

    await act(async () => {
      resolveGen({ success: true });
      await genPromise;
    });

    expect(params.setGenerating).not.toHaveBeenCalled();
    expect(params.setGeneratingLabel).not.toHaveBeenCalled();
  });

  it("TC-REF-10 & WP-1: uploads reference images directly and sends referenceImagePaths (no base64) for single generation", async () => {
    const f1 = new File(["1"], "ref1.png", { type: "image/png" });
    const f2 = new File(["2"], "ref2.webp", { type: "image/webp" });
    mockUploadReferenceImages.mockResolvedValueOnce(["u/conv-1/ref-1.png", "u/conv-1/ref-2.webp"]);
    mockPostGenerateImageRequest.mockResolvedValueOnce({ success: true });

    const params = buildParams({ referenceImages: [f1, f2], numberOfImages: 1 });
    const { result } = renderHook(() => useImageStudioActions(params));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(mockUploadReferenceImages).toHaveBeenCalledTimes(1);
    expect(mockUploadReferenceImages).toHaveBeenCalledWith(
      [f1, f2],
      "conv-1",
      "studioRefUploadFailed"
    );
    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(1);
    const reqBody = mockPostGenerateImageRequest.mock.calls[0][0] as {
      options: Record<string, unknown>;
    };
    expect(reqBody.options.referenceImagePaths).toEqual([
      "u/conv-1/ref-1.png",
      "u/conv-1/ref-2.webp",
    ]);
    expect(reqBody.options.referenceImages).toBeUndefined();
    expect(params.setGenerating).toHaveBeenLastCalledWith(false);
  });

  it("TC-REF-10 & NP-4: shows toast.error once, skips generate, and unlocks generatingRef on upload failure", async () => {
    const { ReferenceImageUploadError } = await import("@/lib/features/image-gen/studioHelpers");
    const f1 = new File(["1"], "big.png", { type: "image/png" });
    mockUploadReferenceImages
      .mockRejectedValueOnce(new ReferenceImageUploadError("HTTP 413"))
      .mockResolvedValueOnce(["u/conv-1/ref-retry.png"]);
    mockPostGenerateImageRequest.mockResolvedValueOnce({ success: true });

    const params = buildParams({ referenceImages: [f1], numberOfImages: 1 });
    const { result } = renderHook(() => useImageStudioActions(params));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("studioRefUploadFailed");
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Gen Error:",
      expect.any(ReferenceImageUploadError)
    );
    expect(mockPostGenerateImageRequest).not.toHaveBeenCalled();
    expect(params.setGenerating).toHaveBeenLastCalledWith(false);

    // Retry succeeds -> proves zero deadlock
    await act(async () => {
      await result.current.handleGenerate();
    });
    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(1);
  });

  it("TC-REF-11, WP-1 & NP-4: isolates paths per batch branch, shows single toast on total batch upload failure, and preserves partial success", async () => {
    const { ReferenceImageUploadError } = await import("@/lib/features/image-gen/studioHelpers");
    const f1 = new File(["1"], "ref1.png", { type: "image/png" });
    const f2 = new File(["2"], "ref2.png", { type: "image/png" });

    // (a) Batch of 3 succeeds: each branch gets its own distinct referenceImagePaths
    mockUploadReferenceImages
      .mockResolvedValueOnce(["u/conv-1/ref-a1.png", "u/conv-1/ref-a2.png"])
      .mockResolvedValueOnce(["u/conv-1/ref-b1.png", "u/conv-1/ref-b2.png"])
      .mockResolvedValueOnce(["u/conv-1/ref-c1.png", "u/conv-1/ref-c2.png"]);
    mockPostGenerateImageRequest.mockResolvedValue({ success: true });

    const paramsBatch = buildParams({ referenceImages: [f1, f2], numberOfImages: 3 });
    const { result: resBatch } = renderHook(() => useImageStudioActions(paramsBatch));

    await act(async () => {
      await resBatch.current.handleGenerate();
    });

    expect(mockUploadReferenceImages).toHaveBeenCalledTimes(3);
    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(3);
    const sentSets = mockPostGenerateImageRequest.mock.calls.map(
      (c) => (c[0] as { options: { referenceImagePaths: string[] } }).options.referenceImagePaths
    );
    expect(sentSets).toEqual([
      ["u/conv-1/ref-a1.png", "u/conv-1/ref-a2.png"],
      ["u/conv-1/ref-b1.png", "u/conv-1/ref-b2.png"],
      ["u/conv-1/ref-c1.png", "u/conv-1/ref-c2.png"],
    ]);

    // (b) All 3 branches fail upload -> toast.error called EXACTLY ONCE (no 3x spam)
    mockToastError.mockClear();
    mockPostGenerateImageRequest.mockClear();
    mockUploadReferenceImages.mockReset();
    mockUploadReferenceImages.mockRejectedValue(new ReferenceImageUploadError("HTTP 413"));

    await act(async () => {
      await resBatch.current.handleGenerate();
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("studioRefUploadFailed");
    expect(mockPostGenerateImageRequest).not.toHaveBeenCalled();

    // (c) Partial batch success: 1 branch succeeds + 1 branch upload fails -> no global error/toast
    mockToastError.mockClear();
    mockPostGenerateImageRequest.mockClear();
    mockUploadReferenceImages.mockReset();
    mockUploadReferenceImages
      .mockResolvedValueOnce(["u/conv-1/ref-ok.png"])
      .mockRejectedValueOnce(new ReferenceImageUploadError("Network blip"));
    mockPostGenerateImageRequest.mockResolvedValueOnce({ success: true });

    const paramsPartial = buildParams({ referenceImages: [f1], numberOfImages: 2 });
    const { result: resPartial } = renderHook(() => useImageStudioActions(paramsPartial));

    await act(async () => {
      await resPartial.current.handleGenerate();
    });

    expect(mockPostGenerateImageRequest).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(paramsPartial.setShowError).not.toHaveBeenCalled();
    expect(paramsPartial.loadConversation).toHaveBeenCalledWith("conv-1");
  });
});
