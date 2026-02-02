import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as limits from "./limits";

const selectMock = vi.fn();
const upsertMock = vi.fn();
let maybeSingleResponse: { data: unknown; error: unknown };

function createBuilder() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(maybeSingleResponse),
        }),
      }),
    }),
    upsert: (...args: unknown[]) => {
      upsertMock(...args);
      return { select: selectMock };
    },
  };
}

vi.mock("./supabase", () => ({
  getSupabaseAdmin: () => ({
    from: () => createBuilder(),
  }),
}));

describe("incrementDailyMessageCount", () => {
  const fixedDate = new Date("2024-05-01T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    selectMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockClear();
    maybeSingleResponse = { data: null, error: null };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    upsertMock.mockReset();
    selectMock.mockReset();
  });

  it("creates a new counter with count 1 when no prior messages exist", async () => {
    maybeSingleResponse = { data: null, error: null };

    await limits.incrementDailyMessageCount("user-123");

    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        date: "2024-05-01",
        count: 1,
      },
      {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      }
    );
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("increments from the current count instead of resetting to 1", async () => {
    maybeSingleResponse = { data: { count: 5 }, error: null };

    await limits.incrementDailyMessageCount("user-123");

    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        date: "2024-05-01",
        count: 6,
      },
      {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      }
    );
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
