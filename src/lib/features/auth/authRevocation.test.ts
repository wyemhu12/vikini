import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use vi.hoisted() to ensure mock instances are available before vi.mock() factory runs
const { mockRedisInstance, mockSupabaseAdmin } = vi.hoisted(() => {
  return {
    mockRedisInstance: {
      get: vi.fn(),
      setex: vi.fn(),
    },
    mockSupabaseAdmin: {
      from: vi.fn(),
    },
  };
});

vi.mock("@upstash/redis", () => ({
  // Must use function() not arrow — arrow functions cannot be used as constructors with `new`
  Redis: vi.fn().mockImplementation(function () {
    return mockRedisInstance;
  }),
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

import {
  bumpAuthVersion,
  getAuthVersion,
  refreshTokenFromDB,
  AUTH_VERSION_TTL,
} from "./authRevocation";

describe("authRevocation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://test-redis.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("bumpAuthVersion", () => {
    it("should set Redis key with current timestamp and TTL", async () => {
      mockRedisInstance.setex.mockResolvedValue("OK");

      await bumpAuthVersion("user-123");

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        "auth:version:user-123",
        AUTH_VERSION_TTL,
        expect.any(Number)
      );
    });

    it("should handle missing Redis gracefully", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";
      vi.resetModules();

      const { bumpAuthVersion: bump } = await import("./authRevocation");
      await expect(bump("user-123")).resolves.not.toThrow();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error("Redis connection failure"));

      await expect(bumpAuthVersion("user-123")).resolves.not.toThrow();
    });
  });

  describe("getAuthVersion", () => {
    it("should return timestamp number when Redis returns a number", async () => {
      mockRedisInstance.get.mockResolvedValue(1700000000000);

      const result = await getAuthVersion("user-123");

      expect(result).toBe(1700000000000);
      expect(mockRedisInstance.get).toHaveBeenCalledWith("auth:version:user-123");
    });

    it("should parse and return timestamp number when Redis returns a valid string", async () => {
      mockRedisInstance.get.mockResolvedValue("1700000000000");

      const result = await getAuthVersion("user-123");

      expect(result).toBe(1700000000000);
    });

    it("should return null when key does not exist", async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await getAuthVersion("user-123");

      expect(result).toBeNull();
    });

    it("should return null when Redis is unavailable", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "";
      vi.resetModules();

      const { getAuthVersion: getVer } = await import("./authRevocation");
      const result = await getVer("user-123");

      expect(result).toBeNull();
    });

    it("should return null when Redis throws an error", async () => {
      mockRedisInstance.get.mockRejectedValue(new Error("Redis error"));

      const result = await getAuthVersion("user-123");

      expect(result).toBeNull();
    });
  });

  describe("refreshTokenFromDB", () => {
    it("should return profile data when user is found", async () => {
      const mockEq = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "user-123", rank: "pro", is_blocked: false },
          error: null,
        }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await refreshTokenFromDB("test@example.com");

      expect(result).toEqual({
        userId: "test@example.com",
        rank: "pro",
        isBlocked: false,
      });
    });

    it("should return null when user is not found", async () => {
      const mockEq = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      const result = await refreshTokenFromDB("notfound@example.com");

      expect(result).toBeNull();
    });

    it("should return null on DB error", async () => {
      const mockEq = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("DB connection error"),
        }),
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      const result = await refreshTokenFromDB("test@example.com");

      expect(result).toBeNull();
    });

    it("should return null when email is empty", async () => {
      const result = await refreshTokenFromDB("  ");
      expect(result).toBeNull();
    });
  });
});
