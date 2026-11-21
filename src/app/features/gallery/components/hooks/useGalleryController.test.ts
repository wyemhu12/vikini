import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useGalleryController } from "./useGalleryController";
import { toast } from "@/lib/store/toastStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "vi",
  }),
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

describe("useGalleryController (NP-4)", () => {
  const originalFetch = global.fetch;
  const originalIO = global.IntersectionObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.IntersectionObserver = originalIO;
  });

  it("sets error on HTTP 500 and clears error on retryLoad() recovery", async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 500, json: async () => ({ error: "Server error" }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            images: [
              {
                id: "img-1",
                url: "https://example.com/1.png",
                prompt: "Sunset",
                createdAt: "2026-06-01T00:00:00Z",
              },
            ],
            hasMore: false,
          },
        }),
      };
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGalleryController());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("galleryLoadFailed");
    expect(result.current.images).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("galleryLoadFailed");

    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].id).toBe("img-1");
  });

  it("ignores stale network errors from superseded requests via requestIdRef", async () => {
    let rejectFirst!: (reason?: unknown) => void;
    let callIdx = 0;

    global.fetch = vi.fn().mockImplementation(() => {
      callIdx += 1;
      if (callIdx === 1) {
        return new Promise((_resolve, reject) => {
          rejectFirst = reject;
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            images: [
              {
                id: "img-fresh",
                url: "https://example.com/fresh.png",
                prompt: "Fresh image",
                createdAt: "2026-06-02T00:00:00Z",
              },
            ],
            hasMore: false,
          },
        }),
      });
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useGalleryController());

    // Issue a newer request before the first resolves
    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.images).toHaveLength(1);
    });

    // Now fail the superseded request #1
    await act(async () => {
      rejectFirst(new Error("Stale timeout"));
      await Promise.resolve();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.images[0].id).toBe("img-fresh");
    expect(toast.error).not.toHaveBeenCalled();
  });
});
