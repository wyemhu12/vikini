import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Redis } from "@upstash/redis";
import { tryClaimBatchGenSlot, resetInMemoryQuotaStore, getRedis } from "./batchGenQuota";
import { resetSharedRedisForTests } from "./redis.server";

const mockRedisInstance = {
  incr: vi.fn(),
  decr: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@upstash/redis", () => {
  return {
    Redis: vi.fn().mockImplementation(function () {
      return mockRedisInstance;
    }),
  };
});

describe("batchGenQuota - tryClaimBatchGenSlot", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryQuotaStore();
    resetSharedRedisForTests();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
    resetSharedRedisForTests();
  });

  it("should immediately allow batchSize <= 1 without checking Redis or quota", async () => {
    const result1 = await tryClaimBatchGenSlot("user-1", "basic", 1);
    expect(result1.claimed).toBe(true);

    const result0 = await tryClaimBatchGenSlot("user-1", "basic", 0);
    expect(result0.claimed).toBe(true);
  });

  it("should reject batchSize exceeding rank maxBatchSize", async () => {
    // Basic maxBatchSize is 2
    const result = await tryClaimBatchGenSlot("user-1", "basic", 3);
    expect(result.claimed).toBe(false);
    if (!result.claimed) {
      expect(result.code).toBe("BATCH_SIZE_EXCEEDS_RANK");
      expect(result.reason).toContain("exceeds rank limit");
    }
  });

  it("should reject batchSize for not_whitelisted rank", async () => {
    const result = await tryClaimBatchGenSlot("user-1", "not_whitelisted", 2);
    expect(result.claimed).toBe(false);
    if (!result.claimed) {
      expect(result.code).toBe("BATCH_SIZE_EXCEEDS_RANK");
    }
  });

  it("should fail-closed in production when Redis is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = await tryClaimBatchGenSlot("user-1", "basic", 2);
    expect(result.claimed).toBe(false);
    if (!result.claimed) {
      expect(result.code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  it("should use in-memory fallback in development when Redis is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Basic rank batchSize: 2 has quota 10
    for (let i = 0; i < 10; i++) {
      const res = await tryClaimBatchGenSlot("user-dev", "basic", 2);
      expect(res.claimed).toBe(true);
    }

    // 11th should exceed quota
    const exceeded = await tryClaimBatchGenSlot("user-dev", "basic", 2);
    expect(exceeded.claimed).toBe(false);
    if (!exceeded.claimed) {
      expect(exceeded.code).toBe("BATCH_GEN_LIMIT_EXCEEDED");
    }
  });

  it("should allow rollback in in-memory fallback", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    // Fill to 10
    const claims = [];
    for (let i = 0; i < 10; i++) {
      claims.push(await tryClaimBatchGenSlot("user-rb", "basic", 2));
    }

    // Rollback one slot
    const lastClaim = claims[claims.length - 1];
    if (lastClaim.claimed) {
      await lastClaim.rollback();
    }

    // Should be able to claim 1 more
    const retry = await tryClaimBatchGenSlot("user-rb", "basic", 2);
    expect(retry.claimed).toBe(true);
  });

  it("delegates getRedis() to shared Redis singleton (TC-W2A-13)", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://shared-redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "shared-token");

    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);
    expect(Redis).toHaveBeenCalledTimes(1);
  });
});
