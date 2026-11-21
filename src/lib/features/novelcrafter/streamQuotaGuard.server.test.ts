// /lib/features/novelcrafter/streamQuotaGuard.server.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core/redis.server", () => ({
  getSharedRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/core/limits", () => ({
  checkDailyMessageLimit: vi.fn().mockResolvedValue({
    canSend: true,
    count: 9,
    limit: 10,
    rank: "basic",
  }),
  incrementDailyMessageCount: vi.fn().mockResolvedValue(undefined),
}));

import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import { getSharedRedis } from "@/lib/core/redis.server";
import {
  reserveNovelcrafterStreamQuota,
  resetLocalInFlightQuotaForTests,
} from "./streamQuotaGuard.server";

describe("streamQuotaGuard.server", () => {
  beforeEach(() => {
    resetLocalInFlightQuotaForTests();
    vi.clearAllMocks();
    vi.mocked(getSharedRedis).mockReturnValue(null);
    vi.mocked(checkDailyMessageLimit).mockResolvedValue({
      canSend: true,
      count: 9,
      limit: 10,
      remaining: 1,
      rank: "basic",
    });
    vi.mocked(incrementDailyMessageCount).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("TC-03 & TC-04: reserves in-flight quota atomically and only commits daily usage on first model output", async () => {
    // User has count=9, limit=10 -> 1st concurrent stream is allowed (effectiveCount=10)
    const lease1 = await reserveNovelcrafterStreamQuota("user-1");
    expect(lease1.allowed).toBe(true);

    // 2nd concurrent stream while 1st is in-flight exceeds limit (effectiveCount=11 > 10)
    const lease2 = await reserveNovelcrafterStreamQuota("user-1");
    expect(lease2.allowed).toBe(false);

    if (lease1.allowed) {
      // Release without model output -> daily usage not incremented
      await lease1.releaseReservation();
      expect(incrementDailyMessageCount).not.toHaveBeenCalled();
    }

    // Now a new stream can reserve again, and when it emits first model output, daily usage is committed once
    const lease3 = await reserveNovelcrafterStreamQuota("user-1");
    expect(lease3.allowed).toBe(true);
    if (lease3.allowed) {
      lease3.onFirstModelOutput();
      lease3.onFirstModelOutput();
      await lease3.releaseReservation();
      expect(incrementDailyMessageCount).toHaveBeenCalledTimes(1);
    }
  });

  it("TC-02: refreshes Redis TTL with NX when inFlight > 1 and uses atomic Lua eval for release/rollback", async () => {
    const mockRedis = {
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3),
      expire: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockResolvedValue(0),
      decr: vi.fn().mockResolvedValue(0),
    };
    vi.mocked(getSharedRedis).mockReturnValue(
      mockRedis as unknown as ReturnType<typeof getSharedRedis>
    );
    vi.mocked(checkDailyMessageLimit).mockResolvedValue({
      canSend: true,
      count: 8,
      limit: 10,
      remaining: 2,
      rank: "basic",
    });

    // 1st stream: inFlight = 1 -> expire(key, 360) without NX
    const r1 = await reserveNovelcrafterStreamQuota("user-redis");
    expect(r1).toMatchObject({ allowed: true, count: 9, limit: 10 });
    expect(mockRedis.expire).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("nc-stream-inflight:user-redis:"),
      360
    );

    // 2nd stream: inFlight = 2 -> expire(key, 360, "NX")
    const r2 = await reserveNovelcrafterStreamQuota("user-redis");
    expect(r2).toMatchObject({ allowed: true, count: 10, limit: 10 });
    expect(mockRedis.expire).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("nc-stream-inflight:user-redis:"),
      360,
      "NX"
    );

    // 3rd stream: inFlight = 3 (effectiveCount = 11 > 10) -> rejected and rolled back via Lua eval
    const r3 = await reserveNovelcrafterStreamQuota("user-redis");
    expect(r3).toEqual({ allowed: false, count: 10, limit: 10 });
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);

    // Releasing r1 multiple times calls eval only once
    if (r1.allowed) {
      await r1.releaseReservation();
      await r1.releaseReservation();
    }
    expect(mockRedis.eval).toHaveBeenCalledTimes(2);
  });

  it("TC-W2A-18 / NP-05 (Redis): releases in-flight slot immediately after daily increment settles and avoids double-counting or double-decrementing", async () => {
    let redisInFlight = 0;
    const mockRedis = {
      incr: vi.fn().mockImplementation(async () => {
        redisInFlight += 1;
        return redisInFlight;
      }),
      expire: vi.fn().mockResolvedValue(1),
      eval: vi.fn().mockImplementation(async () => {
        redisInFlight = Math.max(0, redisInFlight - 1);
        return redisInFlight;
      }),
    };
    vi.mocked(getSharedRedis).mockReturnValue(
      mockRedis as unknown as ReturnType<typeof getSharedRedis>
    );

    let dbCount = 8;
    vi.mocked(checkDailyMessageLimit).mockImplementation(async () => ({
      canSend: dbCount < 10,
      count: dbCount,
      limit: 10,
      remaining: Math.max(0, 10 - dbCount),
      rank: "basic",
    }));
    vi.mocked(incrementDailyMessageCount).mockImplementation(async () => {
      dbCount += 1;
    });

    // Stream #1 reserves: count=8, inFlight=1 => effectiveCount=9 <= 10
    const lease1 = await reserveNovelcrafterStreamQuota("user-no-double");
    expect(lease1.allowed).toBe(true);
    expect(redisInFlight).toBe(1);

    // Stream #1 emits first token -> increments DB count to 9 and immediately releases in-flight slot
    if (lease1.allowed) {
      lease1.onFirstModelOutput();
    }
    await vi.waitFor(() => {
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });
    expect(dbCount).toBe(9);
    expect(redisInFlight).toBe(0);

    // While Stream #1 is STILL running (releaseReservation not yet called), Stream #2 reserves:
    // DB count=9 + inFlight=1 => effectiveCount=10 <= 10 -> ALLOWED (not double-counted as 11!)
    const lease2 = await reserveNovelcrafterStreamQuota("user-no-double");
    expect(lease2).toMatchObject({ allowed: true, count: 10, limit: 10 });

    // When Stream #1 finishes and calls releaseReservation(), eval is NOT called a second time
    if (lease1.allowed) {
      await lease1.releaseReservation();
    }
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    expect(redisInFlight).toBe(1);

    if (lease2.allowed) {
      await lease2.releaseReservation();
    }
    expect(mockRedis.eval).toHaveBeenCalledTimes(2);
    expect(redisInFlight).toBe(0);
  });

  it("TC-W2A-18 / NP-05 (Local fallback): prevents double-count after onFirstModelOutput and fails closed with 503 in production", async () => {
    let dbCount = 8;
    vi.mocked(checkDailyMessageLimit).mockImplementation(async () => ({
      canSend: dbCount < 10,
      count: dbCount,
      limit: 10,
      remaining: Math.max(0, 10 - dbCount),
      rank: "basic",
    }));
    vi.mocked(incrementDailyMessageCount).mockImplementation(async () => {
      dbCount += 1;
    });

    const lease1 = await reserveNovelcrafterStreamQuota("user-local-no-double");
    expect(lease1.allowed).toBe(true);
    if (lease1.allowed) {
      lease1.onFirstModelOutput();
    }
    await vi.waitFor(() => {
      expect(dbCount).toBe(9);
    });

    // Stream #2 starts while Stream #1 has not called releaseReservation()
    const lease2 = await reserveNovelcrafterStreamQuota("user-local-no-double");
    expect(lease2).toMatchObject({ allowed: true, count: 10, limit: 10 });

    if (lease1.allowed) await lease1.releaseReservation();
    if (lease2.allowed) await lease2.releaseReservation();

    // Production without Redis must fail closed with 503 QUOTA_SERVICE_UNAVAILABLE
    vi.stubEnv("NODE_ENV", "production");
    await expect(reserveNovelcrafterStreamQuota("user-prod")).rejects.toMatchObject({
      statusCode: 503,
      code: "QUOTA_SERVICE_UNAVAILABLE",
    });
  });
});
