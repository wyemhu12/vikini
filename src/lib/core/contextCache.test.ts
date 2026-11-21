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
        userId: "user-a@example.com",
        model: "gemini-4-neon",
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
        userId: "user-a@example.com",
        model: "gemini-3.5-flash-lite",
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
        userId: "user-a@example.com",
        model: "deepseek-v4-flash",
        systemInstruction: "C".repeat(5000),
      });
      expect(nonGeminiResult).toBeNull();

      const shortResult = await getOrCreateCompositeCache({
        userId: "user-a@example.com",
        model: "gemini-3.5-flash-lite",
        systemInstruction: "short",
      });
      expect(shortResult).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(0);
    });

    it("catches API errors gracefully and returns null", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");
      mockCachesCreate.mockRejectedValueOnce(new Error("Cache quota exceeded"));

      const result = await getOrCreateCompositeCache({
        userId: "user-a@example.com",
        model: "gemini-3.5-flash-lite",
        systemInstruction: "D".repeat(5000),
      });

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
    });

    it("isolates cache entries across different users with identical systemInstruction (TC-W1-03)", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");
      mockCachesCreate
        .mockResolvedValueOnce({ name: "cachedContents/user-a" })
        .mockResolvedValueOnce({ name: "cachedContents/user-b" });

      const sharedInstruction = "S".repeat(5000);
      const resA = await getOrCreateCompositeCache({
        userId: "user-a@example.com",
        model: "gemini-3.5-flash-lite",
        systemInstruction: sharedInstruction,
      });
      const resB = await getOrCreateCompositeCache({
        userId: "user-b@example.com",
        model: "gemini-3.5-flash-lite",
        systemInstruction: sharedInstruction,
      });
      const resAHit = await getOrCreateCompositeCache({
        userId: "user-a@example.com",
        model: "gemini-3.5-flash-lite",
        systemInstruction: sharedInstruction,
      });

      expect(mockCachesCreate).toHaveBeenCalledTimes(2);
      expect(resA).toEqual({ cacheName: "cachedContents/user-a", cacheHit: false });
      expect(resB).toEqual({ cacheName: "cachedContents/user-b", cacheHit: false });
      expect(resAHit).toEqual({ cacheName: "cachedContents/user-a", cacheHit: true });
    });

    it("fails closed (returns null) when userId is empty or whitespace", async () => {
      const { getOrCreateCompositeCache } = await import("./contextCache");

      const result = await getOrCreateCompositeCache({
        userId: "   ",
        model: "gemini-3.5-flash-lite",
        systemInstruction: "X".repeat(5000),
      });

      expect(result).toBeNull();
      expect(mockCachesCreate).not.toHaveBeenCalled();
    });

    it("caps activeCacheNames at 500 entries for composite caches (TC-W1-03)", async () => {
      const { getOrCreateCompositeCache, getCacheStats } = await import("./contextCache");
      let counter = 0;
      mockCachesCreate.mockImplementation(async () => ({
        name: `cachedContents/comp-${++counter}`,
      }));

      for (let i = 0; i < 510; i++) {
        await getOrCreateCompositeCache({
          userId: `user-${i}@example.com`,
          model: "gemini-3.5-flash-lite",
          systemInstruction: `${"P".repeat(4200)}-${i}`,
        });
      }

      expect(getCacheStats().activeCaches).toBeLessThanOrEqual(500);
    });

    it("getOrCreateSystemCache delegates with userId cleanly", async () => {
      const { getOrCreateSystemCache } = await import("./contextCache");
      mockCachesCreate.mockResolvedValueOnce({ name: "cachedContents/sys-1" });

      const result = await getOrCreateSystemCache(
        "gemini-3.5-flash-lite",
        "Y".repeat(5000),
        "user-sys@example.com"
      );

      expect(result).toEqual({ cacheName: "cachedContents/sys-1", cacheHit: false });
    });
  });

  describe("getOrCreateKBCache", () => {
    it("returns null and does not call caches.create for gemini-4-argon", async () => {
      const { getOrCreateKBCache } = await import("./contextCache");
      const kbContents = [{ role: "user", parts: [{ text: "E".repeat(5000) }] }];

      const result = await getOrCreateKBCache("gemini-4-neon", "proj-1", kbContents);

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(0);
    });

    it("creates KB cache for gemini-3-flash-preview when content is large", async () => {
      const { getOrCreateKBCache } = await import("./contextCache");
      mockCachesCreate.mockResolvedValueOnce({ name: "cachedContents/kb-123" });
      const kbContents = [{ role: "user", parts: [{ text: "F".repeat(5000) }] }];

      const result = await getOrCreateKBCache("gemini-3.5-flash-lite", "proj-1", kbContents);

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

      const result = await getOrCreateKBCache("gemini-3.5-flash-lite", "proj-2", kbContents);

      expect(result).toBeNull();
      expect(mockCachesCreate).toHaveBeenCalledTimes(1);
    });

    it("caps activeCacheNames at 500 entries for KB caches (TC-W1-03)", async () => {
      const { getOrCreateKBCache, getCacheStats } = await import("./contextCache");
      let counter = 0;
      mockCachesCreate.mockImplementation(async () => ({
        name: `cachedContents/kb-${++counter}`,
      }));

      for (let i = 0; i < 510; i++) {
        await getOrCreateKBCache("gemini-3.5-flash-lite", `proj-${i}`, [
          { role: "user", parts: [{ text: `${"K".repeat(4200)}-${i}` }] },
        ]);
      }

      expect(getCacheStats().activeCaches).toBeLessThanOrEqual(500);
    });
  });
});
