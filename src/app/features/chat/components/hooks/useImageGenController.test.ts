import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useImageGenController } from "./useImageGenController";

describe("useImageGenController (TC-IMG-07..TC-IMG-08)", () => {
  const identityT = (key: string) => key;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("TC-IMG-07 & NP-1: handles 504 plain-text gateway timeout without JSON SyntaxError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("An error occurred with your deployment", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        })
      )
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useImageGenController({
        selectedConversationId: "conv-123",
        createConversation: vi.fn(),
        setSelectedConversationIdAndUrl: vi.fn(),
        currentModel: "gemini-3.1-flash",
        onSuccess,
        t: identityT,
      })
    );

    let ok: boolean | undefined = true;
    await act(async () => {
      ok = await result.current.handleImageGen("Draw a black dragon");
    });

    expect(ok).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith("studioErrorTimeout");
    expect(mockToastError.mock.calls[0]?.[0]).not.toContain("Unexpected token");
    expect(result.current.lastGeneratedImage).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("TC-IMG-08: updates lastGeneratedImage, shows success toast, and calls onSuccess on 200 OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { imageUrl: "https://cdn/1.png", message: { id: "m1" } },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useImageGenController({
        selectedConversationId: "conv-123",
        createConversation: vi.fn(),
        setSelectedConversationIdAndUrl: vi.fn(),
        currentModel: "gemini-3.1-flash",
        onSuccess,
        t: identityT,
      })
    );

    let ok: boolean | undefined = false;
    await act(async () => {
      ok = await result.current.handleImageGen("Draw a sunrise");
    });

    expect(ok).toBe(true);
    expect(result.current.lastGeneratedImage).toEqual({
      url: "https://cdn/1.png",
      prompt: "Draw a sunrise",
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("studioGenerateSuccess");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
