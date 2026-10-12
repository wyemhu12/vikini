import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConversationBranching } from "./useConversationBranching";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const t = (key: string) => `t:${key}`;

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

function setup(selectedConversationId: string | null = "conv-1") {
  const refreshConversations = vi.fn().mockResolvedValue(undefined);
  const onBranchCreated = vi.fn();
  const hook = renderHook(() =>
    useConversationBranching({ selectedConversationId, refreshConversations, onBranchCreated, t })
  );
  return { ...hook, refreshConversations, onBranchCreated };
}

describe("useConversationBranching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing without a selected conversation", async () => {
    const { result } = setup(null);
    await act(() => result.current.handleBranchMessage("msg-1"));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("branches, refreshes and navigates to the new conversation", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { conversation: { id: "conv-2" } } })
    );
    const { result, refreshConversations, onBranchCreated } = setup();

    await act(() => result.current.handleBranchMessage("msg-1"));

    expect(mockFetch).toHaveBeenCalledWith("/api/conversations/conv-1/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", titlePrefix: "t:branchTitlePrefix" }),
    });
    expect(toast.success).toHaveBeenCalledWith("t:branchSuccess");
    expect(refreshConversations).toHaveBeenCalledTimes(1);
    expect(onBranchCreated).toHaveBeenCalledWith("conv-2");
    expect(result.current.branchingMessageId).toBeNull();
  });

  it("exposes branchingMessageId while the request is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    mockFetch.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = setup();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.handleBranchMessage("msg-1");
    });
    expect(result.current.branchingMessageId).toBe("msg-1");

    await act(async () => {
      resolve(jsonResponse({ success: true, data: { conversation: { id: "conv-2" } } }));
      await pending;
    });
    expect(result.current.branchingMessageId).toBeNull();
  });

  it("shows the server error message on failure", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { message: "Message not found" } }, false)
    );
    const { result, onBranchCreated } = setup();

    await act(() => result.current.handleBranchMessage("msg-1"));

    expect(toast.error).toHaveBeenCalledWith("Message not found");
    expect(logger.error).toHaveBeenCalled();
    expect(onBranchCreated).not.toHaveBeenCalled();
    expect(result.current.branchingMessageId).toBeNull();
  });

  it("falls back to the translated message when the server gives none", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false }, false));
    const { result } = setup();

    await act(() => result.current.handleBranchMessage("msg-1"));

    expect(toast.error).toHaveBeenCalledWith("t:branchFailed");
  });

  it("uses the translated fallback for non-Error rejections", async () => {
    mockFetch.mockRejectedValueOnce("network down");
    const { result } = setup();

    await act(() => result.current.handleBranchMessage("msg-1"));

    expect(toast.error).toHaveBeenCalledWith("t:branchFailed");
    expect(result.current.branchingMessageId).toBeNull();
  });
});
