import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCachesCreate = vi.fn();

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    caches: {
      create: mockCachesCreate,
    },
  }),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe("contextCache", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCachesCreate.mockReset();
  });

  describe("getOrCreateCompositeCache", () => {
    it("returns null and does not call caches.create for gemini-4-argon (implicit caching only)", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");
      const longInstruction = "A".repeat(5000);

      const result = await getOrCreateCompositeCache({
        model: "gemini-4-argon",
        systemInstruction: longInstruction,
      });

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(0);
    });

    it("creates explicit cache for gemini-3-flash-preview when instruction >= 4096 chars", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");
      mockCachesCreate.mockResolvedValueOnce({ name: "cachedContents/test-123" });
      const longInstruction = "B".repeat(5000);

      const result = await getOrCreateCompositeCache({
        model: "gemini-3-flash-preview",
        systemInstruction: longInstruction,
      });

      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        cacheName: "cachedContents/test-123",
        cacheHit: false,
      });
    });

    it("returns null for non-Gemini models or short content", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");

      const nonGeminiResult = await getOrCreateCompositeCache({
        model: "deepseek-v4-flash",
        systemInstruction: "C".repeat(5000),
      });
      expect(nonGeminiResult).toBeNull();

      const shortResult = await getOrCreateCompositeCache({
        model: "gemini-3-flash-preview",
        systemInstruction: "short",
      });
      expect(shortResult).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(0);
    });

    it("catches API errors gracefully and returns null", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");
      mockCachesCreate.mockRejectedValueOnce(new Error("Cache quota exceeded"));

      const result = await getOrCreateCompositeCache({
        model: "gemini-3-flash-preview",
        systemInstruction: "D".repeat(5000),
      });

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOrCreateKBCache", () => {
    it("returns null and does not call caches.create for gemini-4-argon", async () => {
      const { getOrCreateKBCache } = await import("./contextCache");
      const kbContents = [{ role: "user", parts: [{ text: "E".repeat(5000) }] }];

      const result = await getOrCreateKBCache("gemini-4-argon", "proj-1", kbContents);

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(0);
    });

    it("creates KB cache for gemini-3-flash-preview when content is large", async () => {
      const { getOrCreateKBCache } = await import("./contextCache");
      mockCachesCreate.mockResolvedValueOnce({ name: "cachedContents/kb-123" });
      const kbContents = [{ role: "user", parts: [{ text: "F".repeat(5000) }] }];

      const result = await getOrCreateKBCache("gemini-3-flash-preview", "proj-1", kbContents);

      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        cacheName: "cachedContents/kb-123",
        cacheHit: false,
      });
    });

    it("returns null on API error during KB cache creation", async () => {
      const { getOrCreateKBCache } = await import("./contextCache");
      mockCachesCreate.mockRejectedValueOnce(new Error("KB cache creation failed"));
      const kbContents = [{ role: "user", parts: [{ text: "G".repeat(5000) }] }];

      const result = await getOrCreateKBCache("gemini-3-flash-preview", "proj-2", kbContents);

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
    });
  });
});
