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

import { incrementDailyMessageCount } from "@/lib/core/limits";
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
});
