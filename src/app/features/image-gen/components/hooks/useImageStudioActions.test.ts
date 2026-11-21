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
    readStoredApiKey: () => "test-key",
    convertReferenceImagesToBase64: async () => [],
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
});
