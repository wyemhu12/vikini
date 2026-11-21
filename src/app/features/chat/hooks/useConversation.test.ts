import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversation } from "./useConversation";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";

interface SwrState {
  data: { conversations?: Array<{ id: string; title: string; createdAt: string }> } | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => Promise<void>;
}

// Stable references across renders: a fresh object per render would retrigger the [data] effect forever.
const stableMutate = vi.fn(async () => undefined);
let swrState: SwrState;

vi.mock("swr", () => ({ default: () => swrState }));
vi.mock("@/lib/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), withContext: () => ({ error: vi.fn() }) },
}));
vi.mock("@/lib/store/toastStore", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("./useLanguage", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));

const LOADED_DATA = {
  conversations: [{ id: "c1", title: "Story", createdAt: "2026-11-11T00:00:00.000Z" }],
};

describe("useConversation isLoadingConversations", () => {
  beforeEach(() => {
    swrState = { data: undefined, error: undefined, isLoading: true, mutate: stableMutate };
  });

  it("TC-15/TC-16: stays loading until the SWR data has been merged into conversations", () => {
    const log: Array<{ loading: boolean; count: number }> = [];
    const { rerender } = renderHook(() => {
      const r = useConversation();
      log.push({ loading: r.isLoadingConversations, count: r.conversations.length });
      return r;
    });
    expect(log.at(-1)).toEqual({ loading: true, count: 0 });

    swrState = { data: LOADED_DATA, error: undefined, isLoading: false, mutate: stableMutate };
    rerender();

    // TC-15: no render may report "not loading" while the merged list is still empty.
    expect(log.some((e) => !e.loading && e.count === 0)).toBe(false);
    // TC-16: after the merge effect the list is present and loading is false.
    expect(log.at(-1)).toEqual({ loading: false, count: 1 });
  });

  it("TC-17: an SWR error ends the loading state instead of getting stuck", () => {
    const { result, rerender } = renderHook(() => useConversation());
    expect(result.current.isLoadingConversations).toBe(true);
    swrState = {
      data: undefined,
      error: new Error("401"),
      isLoading: false,
      mutate: stableMutate,
    };
    rerender();
    expect(result.current.isLoadingConversations).toBe(false);
  });
});

describe("useConversationMutations error feedback & partial delete-all (TC-W2B-16 / NP-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrState = {
      data: {
        conversations: [
          { id: "c1", title: "First", createdAt: "2026-11-11T00:00:00.000Z" },
          { id: "c2", title: "Second", createdAt: "2026-11-12T00:00:00.000Z" },
        ],
      },
      error: undefined,
      isLoading: false,
      mutate: stableMutate,
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes conversation id and calls both logger.error and toast.error on loadConversation HTTP 500", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useConversation());
    await act(async () => {
      await result.current.loadConversation("conv+1/test");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/conversations?id=conv%2B1%2Ftest");
    expect(logger.error).toHaveBeenCalledWith("loadConversation error:", expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith("loadMessagesFailed");
  });

  it("keeps failed conversations in local state during partial deleteAllConversations and calls mutate", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id?: string };
      if (body.id === "c1") {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 500 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useConversation());
    expect(result.current.conversations.map((c) => c.id)).toEqual(["c2", "c1"]);

    await act(async () => {
      await result.current.deleteAllConversations();
    });

    expect(result.current.conversations.map((c) => c.id)).toEqual(["c2"]);
    expect(logger.error).toHaveBeenCalledWith("deleteConversation error:", expect.any(Error));
    expect(toast.error).toHaveBeenCalledWith("deleteChatFailed2");
    expect(stableMutate).toHaveBeenCalledTimes(1);
  });
});
