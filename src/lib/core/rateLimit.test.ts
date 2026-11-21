import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEval = vi.fn();
const mockGetSharedRedis = vi.fn();

vi.mock("./redis.server", () => ({
  getSharedRedis: () => mockGetSharedRedis(),
}));

import {
  consumeRateLimit,
  checkRateLimit,
  rateLimitHeaders,
  SLIDING_WINDOW_LUA,
  MAX_MEM_STORE_ENTRIES,
  resetInMemoryRateLimitForTests,
  getInMemoryStoreSizeForTests,
} from "./rateLimit";

describe("rateLimit", () => {
  const origLimit = process.env.RATE_LIMIT_MAX;
  const origWindow = process.env.RATE_LIMIT_WINDOW_SECONDS;

  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryRateLimitForTests();
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_SECONDS;
  });

  afterEach(() => {
    if (origLimit === undefined) delete process.env.RATE_LIMIT_MAX;
    else process.env.RATE_LIMIT_MAX = origLimit;
    if (origWindow === undefined) delete process.env.RATE_LIMIT_WINDOW_SECONDS;
    else process.env.RATE_LIMIT_WINDOW_SECONDS = origWindow;
  });

  it("uses atomic Lua script via Upstash Redis and computes retryAfter from oldest score", async () => {
    process.env.RATE_LIMIT_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
    const now = 1_700_000_050_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    mockGetSharedRedis.mockReturnValue({ eval: mockEval });
    // Oldest request was 45s ago => 15s remaining in 60s window
    mockEval.mockResolvedValueOnce([1, 2, now - 45_000]);

    const res = await consumeRateLimit("user:a@b.com");

    expect(mockEval).toHaveBeenCalledTimes(1);
    expect(mockEval).toHaveBeenCalledWith(
      SLIDING_WINDOW_LUA,
      ["rl:user:a@b.com"],
      [now, 60_000, 3, expect.stringMatching(/^1700000050000:/), 65]
    );
    expect(res).toEqual({
      allowed: true,
      limit: 3,
      remaining: 1,
      resetInMs: 15_000,
      retryAfterSeconds: 15,
      backend: "upstash",
    });

    vi.restoreAllMocks();
  });

  it("negative probe: Lua script does NOT ZADD when already at limit (no lockout extension)", async () => {
    // Verify Lua script checks `if count < limit then` before ZADD
    expect(SLIDING_WINDOW_LUA).toMatch(/if\s+count\s*<\s*limit\s+then[\s\S]*ZADD/);

    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
    const now = 1_700_000_040_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Simulate an in-memory sorted set honoring the exact Lua logic
    const zset: number[] = [];
    mockGetSharedRedis.mockReturnValue({
      eval: vi.fn(
        async (
          _script: string,
          _keys: string[],
          args: [number, number, number, string, number]
        ) => {
          const [ts, winMs, lim] = args;
          const active = zset.filter((s) => s > ts - winMs);
          zset.length = 0;
          zset.push(...active);
          let allowed = 0;
          if (zset.length < lim) {
            zset.push(ts);
            allowed = 1;
          }
          const oldest = zset.length > 0 ? zset[0] : ts;
          return [allowed, zset.length, oldest];
        }
      ),
    });

    const r1 = await consumeRateLimit("burst:user");
    const r2 = await consumeRateLimit("burst:user");
    const r3 = await consumeRateLimit("burst:user");
    const r4 = await consumeRateLimit("burst:user");

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r4.allowed).toBe(false);
    // Rejected retries must NOT have added entries to sorted set
    expect(zset.length).toBe(2);

    vi.restoreAllMocks();
  });

  it("falls back to in-memory limiter when Upstash Redis eval throws", async () => {
    process.env.RATE_LIMIT_MAX = "2";
    mockGetSharedRedis.mockReturnValue({ eval: mockEval });
    mockEval.mockRejectedValue(new Error("Upstash network timeout"));

    const r1 = await consumeRateLimit("failover-key");
    const r2 = await consumeRateLimit("failover-key");
    const r3 = await consumeRateLimit("failover-key");

    expect(r1.backend).toBe("memory");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("enforces MAX_MEM_STORE_ENTRIES ceiling under high-cardinality key flood", async () => {
    mockGetSharedRedis.mockReturnValue(null);
    process.env.RATE_LIMIT_MAX = "5";

    for (let i = 0; i < MAX_MEM_STORE_ENTRIES + 25; i++) {
      await consumeRateLimit(`flood-key-${i}`);
    }

    expect(getInMemoryStoreSizeForTests()).toBeLessThanOrEqual(MAX_MEM_STORE_ENTRIES);
  });

  it("checkRateLimit returns boolean and rateLimitHeaders includes Retry-After only when blocked", async () => {
    mockGetSharedRedis.mockReturnValue(null);
    process.env.RATE_LIMIT_MAX = "1";

    expect(await checkRateLimit("bool-key")).toBe(true);
    expect(await checkRateLimit("bool-key")).toBe(false);

    const okHeaders = rateLimitHeaders({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetInMs: 12_000,
      retryAfterSeconds: 12,
      backend: "memory",
    });
    expect(okHeaders["Retry-After"]).toBeUndefined();
    expect(okHeaders["X-RateLimit-Remaining"]).toBe("9");

    const blockedHeaders = rateLimitHeaders({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetInMs: 12_000,
      retryAfterSeconds: 12,
      backend: "upstash",
    });
    expect(blockedHeaders["Retry-After"]).toBe("12");
  });
});
