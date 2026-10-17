// /lib/features/novelcrafter/streamQuotaGuard.server.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core/batchGenQuota", () => ({
  getRedis: vi.fn().mockReturnValue(null),
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

import { getRedis } from "@/lib/core/batchGenQuota";
import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import {
  reserveNovelcrafterStreamQuota,
  resetLocalInFlightQuotaForTests,
} from "./streamQuotaGuard.server";

describe("streamQuotaGuard.server", () => {
  beforeEach(() => {
    resetLocalInFlightQuotaForTests();
    vi.clearAllMocks();
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
    vi.mocked(getRedis).mockReturnValue(mockRedis as unknown as ReturnType<typeof getRedis>);
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

    vi.mocked(getRedis).mockReturnValue(null);
  });
});
