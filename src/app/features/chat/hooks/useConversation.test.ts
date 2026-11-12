import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversation } from "./useConversation";

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
