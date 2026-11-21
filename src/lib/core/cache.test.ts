// Test file for cache.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCachedConversations,
  setCachedConversations,
  invalidateConversationsCache,
  getCachedGems,
  setCachedGems,
  invalidateGemsCache,
  invalidateAllGemsCache,
} from "./cache";
import { resetSharedRedisForTests } from "./redis.server";

// Mock Redis
const mockRedisInstance = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock("@upstash/redis", () => {
  return {
    Redis: vi.fn().mockImplementation(function () {
      return mockRedisInstance;
    }),
  };
});

describe("Cache", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedRedisForTests();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://test-redis.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetSharedRedisForTests();
  });

  describe("getCachedConversations", () => {
    it("should return null when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      const result = await getCachedConversations("user@example.com");

      expect(result).toBeNull();
    });

    it("should return null when cache miss", async () => {
      // Mock Redis get to return null (cache miss)
      vi.mocked(mockRedisInstance.get).mockResolvedValue(null);

      // Clear the module cache to ensure fresh Redis instance
      vi.resetModules();

      // Re-import to get fresh module with mocked Redis
      const { getCachedConversations: getCached } = await import("./cache");
      const result = await getCached("user@example.com");

      expect(result).toBeNull();
    });
  });

  describe("setCachedConversations", () => {
    it("should not throw when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      await expect(setCachedConversations("user@example.com", [])).resolves.not.toThrow();
    });
  });

  describe("invalidateConversationsCache", () => {
    it("should not throw when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      await expect(invalidateConversationsCache("user@example.com")).resolves.not.toThrow();
    });
  });

  describe("getCachedGems", () => {
    it("should return null when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      const result = await getCachedGems("user@example.com");

      expect(result).toBeNull();
    });
  });

  describe("setCachedGems", () => {
    it("should not throw when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      await expect(setCachedGems("user@example.com", [])).resolves.not.toThrow();
    });
  });

  describe("invalidateGemsCache", () => {
    it("should not throw when Redis is not available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";

      await expect(invalidateGemsCache("user@example.com")).resolves.not.toThrow();
    });
  });

  describe("Cache error handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    describe("getCachedConversations", () => {
      it("should handle JSON parse errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.get).mockResolvedValue("invalid-json");

        const { getCachedConversations: getCached } = await import("./cache");
        const result = await getCached("user@example.com");

        expect(result).toBeNull();
      });

      it("should handle Redis errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.get).mockRejectedValue(new Error("Redis error"));

        const { getCachedConversations: getCached } = await import("./cache");
        const result = await getCached("user@example.com");

        expect(result).toBeNull();
      });
    });

    describe("setCachedConversations", () => {
      it("should handle Redis errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.setex).mockRejectedValue(new Error("Redis error"));
        const testData = [{ id: "1", title: "Test" }];

        const { setCachedConversations: setCached } = await import("./cache");
        await expect(setCached("user@example.com", testData)).resolves.not.toThrow();
      });
    });

    describe("invalidateConversationsCache", () => {
      it("should handle Redis errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.del).mockRejectedValue(new Error("Redis error"));

        const { invalidateConversationsCache: invalidate } = await import("./cache");
        await expect(invalidate("user@example.com")).resolves.not.toThrow();
      });
    });

    describe("getCachedGems", () => {
      it("should handle JSON parse errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.get).mockResolvedValue("invalid-json");

        const { getCachedGems: getCached } = await import("./cache");
        const result = await getCached("user@example.com");

        expect(result).toBeNull();
      });
    });

    describe("setCachedGems", () => {
      it("should handle Redis errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.setex).mockRejectedValue(new Error("Redis error"));
        const testData = [{ id: "1", name: "Test Gem" }];

        const { setCachedGems: setCached } = await import("./cache");
        await expect(setCached("user@example.com", testData)).resolves.not.toThrow();
      });
    });

    describe("invalidateGemsCache", () => {
      it("should handle Redis errors gracefully", async () => {
        vi.resetModules();
        vi.mocked(mockRedisInstance.del).mockRejectedValue(new Error("Redis error"));

        const { invalidateGemsCache: invalidate } = await import("./cache");
        await expect(invalidate("user@example.com")).resolves.not.toThrow();
      });
    });

    describe("invalidateAllGemsCache (TC-W2A-03)", () => {
      it("paginates through SCAN cursor pages and deletes all matching cache:gems:* keys", async () => {
        mockRedisInstance.scan
          .mockResolvedValueOnce(["42", ["cache:gems:a@x.com", "cache:gems:b@x.com"]])
          .mockResolvedValueOnce(["0", ["cache:gems:c@x.com"]]);
        mockRedisInstance.del.mockResolvedValue(1);

        await invalidateAllGemsCache();

        expect(mockRedisInstance.scan).toHaveBeenCalledTimes(2);
        expect(mockRedisInstance.scan).toHaveBeenNthCalledWith(1, 0, {
          match: "cache:gems:*",
          count: 100,
        });
        expect(mockRedisInstance.scan).toHaveBeenNthCalledWith(2, "42", {
          match: "cache:gems:*",
          count: 100,
        });
        expect(mockRedisInstance.del).toHaveBeenNthCalledWith(
          1,
          "cache:gems:a@x.com",
          "cache:gems:b@x.com"
        );
        expect(mockRedisInstance.del).toHaveBeenNthCalledWith(2, "cache:gems:c@x.com");
      });

      it("caps SCAN iterations at 50 and handles Redis errors gracefully", async () => {
        mockRedisInstance.scan.mockResolvedValue(["99", []]);
        await expect(invalidateAllGemsCache()).resolves.not.toThrow();
        expect(mockRedisInstance.scan).toHaveBeenCalledTimes(50);

        mockRedisInstance.scan.mockRejectedValueOnce(new Error("SCAN failed"));
        await expect(invalidateAllGemsCache()).resolves.not.toThrow();
      });
    });
  });
});
