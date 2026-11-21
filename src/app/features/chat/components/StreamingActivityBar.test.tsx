import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StreamingActivityBar } from "./StreamingActivityBar";
import type { StreamActivity } from "@/lib/features/chat/streamActivity";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) => {
      const dict: Record<string, string> = {
        aiIsTyping: "AI is typing",
        streamActivityWritingCode: "Writing code...",
        streamActivityRunningCode: "Running code...",
        streamActivitySearchingWeb: "Searching the web...",
        streamActivityFetchingWeb: "Reading webpage...",
        streamActivityThinking: "Thinking...",
        streamActivityRunningTool: "Running {tool}...",
        streamActivityStillWorking: "Still working...",
        streamActivityGenerating: "Generating response...",
        streamCharsUnit: "{count} chars",
        localLlmQueued: "Waiting in queue ({position})",
        localPromptProgress: "Reading context {pct}%",
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("StreamingActivityBar (TC-SU-04)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Writing code with char counter and live elapsed timer", () => {
    const activity: StreamActivity = {
      phase: "code_writing",
      startedAt: Date.now() - 4_000,
      updatedAt: Date.now(),
      chars: 1250,
    };

    render(
      <StreamingActivityBar activity={activity} isStreaming={true} hasDisplayContent={true} />
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Writing code...")).toBeInTheDocument();
    expect(screen.getByText("1.3K chars")).toBeInTheDocument();
    expect(screen.getByText("4s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("6s")).toBeInTheDocument();
  });

  it("renders TypingDots during initial connecting (<8s) and upgrades to Still working at >=8s", () => {
    const start = Date.now();
    const activity: StreamActivity = {
      phase: "connecting",
      startedAt: start,
      updatedAt: start,
    };

    render(
      <StreamingActivityBar activity={activity} isStreaming={true} hasDisplayContent={false} />
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByTestId("streaming-activity-bar")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9_000);
    });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByTestId("streaming-activity-bar")).toBeInTheDocument();
    expect(screen.getByText("Still working...")).toBeInTheDocument();
    expect(screen.getByText("9s")).toBeInTheDocument();
  });

  it("returns null and clears its interval when isStreaming is false or unmounted", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const activity: StreamActivity = {
      phase: "code_running",
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { rerender, unmount } = render(
      <StreamingActivityBar activity={activity} isStreaming={true} hasDisplayContent={true} />
    );
    expect(screen.getByText("Running code...")).toBeInTheDocument();

    rerender(
      <StreamingActivityBar activity={activity} isStreaming={false} hasDisplayContent={true} />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalled();

    unmount();
  });
});
