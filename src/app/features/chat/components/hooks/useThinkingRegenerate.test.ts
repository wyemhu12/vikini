// /app/features/chat/components/hooks/useThinkingRegenerate.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FrontendMessage } from "../../hooks/useConversation";
import { useThinkingRegenerate } from "./useThinkingRegenerate";

const mockToastInfo = vi.fn();
const mockSetThinkingLevel = vi.fn();

vi.mock("@/lib/store/toastStore", () => ({
  toast: { info: (msg: string) => mockToastInfo(msg), error: vi.fn(), success: vi.fn() },
}));

vi.mock("./useThinkingLevel", () => ({
  useThinkingLevel: () => ({
    thinkingLevel: "high",
    setThinkingLevel: mockSetThinkingLevel,
    availableLevels: ["off", "low", "high"],
  }),
  getLowerThinkingLevel: () => "low",
}));

const DICT: Record<string, string> = {
  thinkingOff: "Tắt",
  thinkingLevelLow: "Nhanh",
  webSearchOff: "TẮT",
  regeneratingWithLowerThinking: "Tạo lại với mức {level}",
};

const MESSAGE: FrontendMessage = { id: "m1", role: "assistant", content: "x" };

describe("useThinkingRegenerate (3D TC-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("labels the off level with thinkingOff, never the web-search OFF key", () => {
    const t = vi.fn((key: string) => DICT[key] ?? key);
    const handleRegenerate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useThinkingRegenerate({
        currentModel: "gemini-3.8-flash",
        isStreaming: false,
        handleRegenerate,
        t,
      })
    );

    act(() => result.current.handleRegenerateWithLowerThinking(MESSAGE, "off"));

    expect(mockSetThinkingLevel).toHaveBeenCalledWith("off");
    expect(mockToastInfo).toHaveBeenCalledWith("Tạo lại với mức Tắt");
    expect(t).not.toHaveBeenCalledWith("webSearchOff");
    expect(handleRegenerate).toHaveBeenCalledWith(MESSAGE);
  });

  it("does nothing while streaming", () => {
    const t = vi.fn((key: string) => DICT[key] ?? key);
    const handleRegenerate = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useThinkingRegenerate({
        currentModel: "gemini-3.8-flash",
        isStreaming: true,
        handleRegenerate,
        t,
      })
    );

    act(() => result.current.handleRegenerateWithLowerThinking(MESSAGE, "off"));

    expect(handleRegenerate).not.toHaveBeenCalled();
    expect(mockToastInfo).not.toHaveBeenCalled();
  });
});
