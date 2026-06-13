import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as limits from "./limits";

const rpcMock = vi.fn();

vi.mock("./supabase.server", () => ({
  getSupabaseAdmin: () => ({
    rpc: rpcMock,
  }),
}));

// Mock Redis (not needed for this test but imported by limits.ts)
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

describe("incrementDailyMessageCount", () => {
  const fixedDate = new Date("2024-05-01T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    rpcMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls RPC with correct user_id and today's date", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await limits.incrementDailyMessageCount("user-123");

    expect(rpcMock).toHaveBeenCalledWith("increment_daily_message_count", {
      p_user_id: "user-123",
      p_date: "2024-05-01",
    });
  });

  it("handles RPC error gracefully without throwing", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "DB connection failed" },
    });

    // Should not throw — function logs warning internally
    await expect(limits.incrementDailyMessageCount("user-123")).resolves.toBeUndefined();

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
