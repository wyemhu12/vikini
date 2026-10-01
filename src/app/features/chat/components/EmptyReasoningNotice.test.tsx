// src/app/features/chat/components/EmptyReasoningNotice.test.tsx
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyReasoningNotice } from "./EmptyReasoningNotice";

// Mock useLanguage
vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        thinkingExhaustedNotice:
          "Reasoning process reached token length limit before generating answer content.",
        thinkingNoResponseAlert:
          "The model finished thinking deliberation without producing answer content.",
        regenerate: "Regenerate",
        regenerateWithLowerThinking: "Regenerate with lower thinking",
      };
      return dict[key] || key;
    },
    language: "en",
  }),
}));

describe("EmptyReasoningNotice", () => {
  it("renders length exhaustion notice when reason is length", () => {
    const onRegenerate = vi.fn();
    render(<EmptyReasoningNotice reason="length" onRegenerate={onRegenerate} />);

    expect(
      screen.getByText(
        "Reasoning process reached token length limit before generating answer content."
      )
    ).toBeDefined();
    expect(screen.getByText("Regenerate")).toBeDefined();
  });

  it("renders no-content alert when reason is no_content or undefined", () => {
    const onRegenerate = vi.fn();
    render(<EmptyReasoningNotice onRegenerate={onRegenerate} />);

    expect(
      screen.getByText("The model finished thinking deliberation without producing answer content.")
    ).toBeDefined();
  });

  it("calls onRegenerate when Regenerate button is clicked", () => {
    const onRegenerate = vi.fn();
    render(<EmptyReasoningNotice onRegenerate={onRegenerate} />);

    fireEvent.click(screen.getByText("Regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("shows and calls onRegenerateLowerThinking when lowerThinkingLevel is available", () => {
    const onRegenerate = vi.fn();
    const onRegenerateLower = vi.fn();

    render(
      <EmptyReasoningNotice
        reason="length"
        onRegenerate={onRegenerate}
        onRegenerateLowerThinking={onRegenerateLower}
        lowerThinkingLevel="low"
      />
    );

    const lowerBtn = screen.getByText("Regenerate with lower thinking");
    expect(lowerBtn).toBeDefined();

    fireEvent.click(lowerBtn);
    expect(onRegenerateLower).toHaveBeenCalledTimes(1);
  });

  it("hides lower thinking button when lowerThinkingLevel is null", () => {
    const onRegenerate = vi.fn();
    const onRegenerateLower = vi.fn();

    render(
      <EmptyReasoningNotice
        reason="length"
        onRegenerate={onRegenerate}
        onRegenerateLowerThinking={onRegenerateLower}
        lowerThinkingLevel={null}
      />
    );

    expect(screen.queryByText("Regenerate with lower thinking")).toBeNull();
  });
});
