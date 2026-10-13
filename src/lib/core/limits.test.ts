import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as limits from "./limits";
import { ServiceUnavailableError, UserBlockedError } from "@/lib/utils/errors";

const rpcMock = vi.fn();

type QueryResult = { data: unknown; error: { message: string } | null };
const tableResults: Record<string, QueryResult> = {};

/** Minimal chainable query builder: every call resolves to the table's configured result. */
function builderFor(table: string) {
  const result = () => Promise.resolve(tableResults[table] ?? { data: null, error: null });
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "update", "upsert"]) builder[m] = () => builder;
  builder.order = result;
  builder.maybeSingle = result;
  builder.then = (resolve: (v: QueryResult) => unknown) => result().then(resolve);
  return builder;
}

vi.mock("./supabase.server", () => ({
  getSupabaseAdmin: () => ({
    rpc: rpcMock,
    from: (table: string) => builderFor(table),
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

    // Should not throw - function logs warning internally
    await expect(limits.incrementDailyMessageCount("user-123")).resolves.toBeUndefined();

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================================
// Fail-closed behavior
// =====================================================================================

const BASIC_ROW = {
  rank: "basic",
  daily_message_limit: 100,
  daily_research_limit: 0,
  max_file_size_mb: 10,
  features: { web_search: true, unlimited_gems: true, deep_research: false },
  allowed_models: ["gemini-2.5-flash"],
};
const PRO_ROW = { ...BASIC_ROW, rank: "pro", daily_message_limit: 500 };

function setProfile(profile: unknown, error: QueryResult["error"] = null) {
  tableResults.profiles = { data: profile, error };
}
function setRankConfigs(rows: unknown[], error: QueryResult["error"] = null) {
  tableResults.rank_configs = { data: rows, error };
}
const profile = (rank: string, is_blocked = false) => ({
  id: "u@x.com",
  email: "u@x.com",
  rank,
  is_blocked,
});

describe("fail-closed limits", () => {
  beforeEach(() => {
    for (const k of Object.keys(tableResults)) delete tableResults[k];
    // Mirrors production today: no "not_whitelisted" row in rank_configs
    setRankConfigs([BASIC_ROW, PRO_ROW]);
    tableResults.daily_message_counts = { data: { count: 3 }, error: null };
  });

  describe("getUserProfileStrict / getUserProfile", () => {
    it("throws 503 on database error, while the legacy helper returns null", async () => {
      setProfile(null, { message: "connection reset" });
      await expect(limits.getUserProfileStrict("u@x.com")).rejects.toBeInstanceOf(
        ServiceUnavailableError
      );
      await expect(limits.getUserProfile("u@x.com")).resolves.toBeNull();
    });

    it("returns null only when the row is missing", async () => {
      setProfile(null);
      await expect(limits.getUserProfileStrict("u@x.com")).resolves.toBeNull();
    });
  });

  describe("getRankConfig", () => {
    it("denies not_whitelisted when its config row is missing (never falls back to basic)", async () => {
      const cfg = await limits.getRankConfig("not_whitelisted");
      expect(cfg.rank).toBe("not_whitelisted");
      expect(cfg.daily_message_limit).toBe(0);
      expect(cfg.max_file_size_mb).toBe(0);
      expect(cfg.features.web_search).toBe(false);
    });

    it("denies unknown ranks", async () => {
      expect((await limits.getRankConfig("superuser")).daily_message_limit).toBe(0);
    });

    it("falls back to basic only for approved ranks", async () => {
      setRankConfigs([BASIC_ROW]);
      expect((await limits.getRankConfig("admin")).daily_message_limit).toBe(100);
    });

    it("throws 503 when rank configs cannot be loaded", async () => {
      setRankConfigs([], { message: "timeout" });
      await expect(limits.getRankConfig("basic")).rejects.toBeInstanceOf(ServiceUnavailableError);
    });
  });

  describe("getUserLimits", () => {
    it("keeps a pending user pending even though their config row is missing", async () => {
      setProfile(profile("not_whitelisted"));
      const l = await limits.getUserLimits("u@x.com");
      expect(l.rank).toBe("not_whitelisted");
      expect(l.daily_message_limit).toBe(0);
    });

    it("treats a missing profile as unapproved", async () => {
      setProfile(null);
      const l = await limits.getUserLimits("u@x.com");
      expect(l.rank).toBe("not_whitelisted");
      expect(l.max_file_size_mb).toBe(0);
    });

    it("throws UserBlockedError for blocked users", async () => {
      setProfile(profile("pro", true));
      await expect(limits.getUserLimits("u@x.com")).rejects.toBeInstanceOf(UserBlockedError);
    });

    it("throws 503 instead of granting basic limits on database error", async () => {
      setProfile(null, { message: "down" });
      await expect(limits.getUserLimits("u@x.com")).rejects.toBeInstanceOf(ServiceUnavailableError);
    });

    it("takes the rank from the profile", async () => {
      setProfile(profile("pro"));
      const l = await limits.getUserLimits("u@x.com");
      expect(l.rank).toBe("pro");
      expect(l.daily_message_limit).toBe(500);
    });
  });

  describe("checkDailyMessageLimit", () => {
    it("reports rank not_whitelisted so chat-stream blocks pending users", async () => {
      setProfile(profile("not_whitelisted"));
      const status = await limits.checkDailyMessageLimit("u@x.com");
      expect(status.rank).toBe("not_whitelisted");
      expect(status.canSend).toBe(false);
    });

    it("computes remaining quota for approved users", async () => {
      setProfile(profile("basic"));
      const status = await limits.checkDailyMessageLimit("u@x.com");
      expect(status).toMatchObject({ count: 3, limit: 100, remaining: 97, canSend: true });
    });

    it("throws 503 when the counter cannot be read", async () => {
      setProfile(profile("basic"));
      tableResults.daily_message_counts = { data: null, error: { message: "down" } };
      await expect(limits.checkDailyMessageLimit("u@x.com")).rejects.toBeInstanceOf(
        ServiceUnavailableError
      );
    });
  });

  describe("tryClaimResearchSlot", () => {
    const RESEARCH_ROW = {
      ...PRO_ROW,
      daily_research_limit: 2,
      features: { ...PRO_ROW.features, deep_research: true },
    };

    beforeEach(() => {
      rpcMock.mockReset();
      rpcMock.mockResolvedValue({ data: null, error: null });
      setProfile(profile("pro"));
      setRankConfigs([BASIC_ROW, RESEARCH_ROW]);
    });

    it("returns false without claiming when the feature is disabled", async () => {
      setRankConfigs([BASIC_ROW, PRO_ROW]);
      await expect(limits.tryClaimResearchSlot("u@x.com")).resolves.toBe(false);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("claims a slot within the limit and rejects over the limit", async () => {
      tableResults.daily_research_counts = { data: { count: 2 }, error: null };
      await expect(limits.tryClaimResearchSlot("u@x.com")).resolves.toBe(true);

      tableResults.daily_research_counts = { data: { count: 3 }, error: null };
      await expect(limits.tryClaimResearchSlot("u@x.com")).resolves.toBe(false);
    });

    it("throws 503 instead of allowing unlimited research when the count cannot be read", async () => {
      tableResults.daily_research_counts = { data: null, error: { message: "down" } };
      await expect(limits.tryClaimResearchSlot("u@x.com")).rejects.toBeInstanceOf(
        ServiceUnavailableError
      );
    });
  });
});
