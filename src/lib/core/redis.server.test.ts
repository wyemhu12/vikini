import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRedisCtor = vi.fn();

vi.mock("@upstash/redis", () => {
  class MockRedis {
    url: string;
    token: string;
    constructor(opts: { url: string; token: string }) {
      mockRedisCtor(opts);
      this.url = opts.url;
      this.token = opts.token;
    }
  }
  return { Redis: MockRedis };
});

import { getSharedRedis, resetSharedRedisForTests } from "./redis.server";

describe("redis.server", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedRedisForTests();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    resetSharedRedisForTests();
  });

  it("returns null when UPSTASH env vars are missing", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(getSharedRedis()).toBeNull();
    expect(mockRedisCtor).not.toHaveBeenCalled();
  });

  it("returns cached singleton instance when credentials are unchanged", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-1";

    const first = getSharedRedis();
    const second = getSharedRedis();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mockRedisCtor).toHaveBeenCalledTimes(1);
    expect(mockRedisCtor).toHaveBeenCalledWith({
      url: "https://example.upstash.io",
      token: "token-1",
    });
  });

  it("recreates instance when credentials rotate", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-1";
    const first = getSharedRedis();

    process.env.UPSTASH_REDIS_REST_TOKEN = "token-2";
    const second = getSharedRedis();

    expect(second).not.toBe(first);
    expect(mockRedisCtor).toHaveBeenCalledTimes(2);
  });

  it("returns null gracefully when Redis constructor throws", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://bad.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "bad-token";
    mockRedisCtor.mockImplementationOnce(() => {
      throw new Error("Invalid URL");
    });

    expect(getSharedRedis()).toBeNull();
  });
});
