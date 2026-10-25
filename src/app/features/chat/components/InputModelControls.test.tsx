import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InputModelControls from "./InputModelControls";

const mockModelSelector = vi.fn();
const mockThinkingSelector = vi.fn();
const mockSupportsThinkingUI = vi.fn();

vi.mock("./ModelSelector", () => ({
  default: (props: Record<string, unknown>) => {
    mockModelSelector(props);
    return <div data-testid="model-selector" />;
  },
}));

vi.mock("./ThinkingLevelSelector", () => ({
  default: (props: Record<string, unknown>) => {
    mockThinkingSelector(props);
    return <div data-testid="thinking-selector" />;
  },
}));

vi.mock("./hooks/useThinkingLevel", () => ({
  modelSupportsThinkingUI: (modelId: string) => mockSupportsThinkingUI(modelId),
}));

describe("InputModelControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both ModelSelector (inline) and ThinkingLevelSelector when model supports thinking UI (T5)", () => {
    mockSupportsThinkingUI.mockReturnValue(true);
    const onSelectModel = vi.fn();
    const isModelAllowed = vi.fn(() => true);
    const setThinkingLevel = vi.fn();

    render(
      <InputModelControls
        currentModel="gemini-4-argon"
        onSelectModel={onSelectModel}
        isModelAllowed={isModelAllowed}
        thinkingLevel="high"
        setThinkingLevel={setThinkingLevel}
        disabled={false}
      />
    );

    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    expect(screen.getByTestId("thinking-selector")).toBeInTheDocument();

    expect(mockModelSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "inline",
        currentModelId: "gemini-4-argon",
        disabled: false,
      })
    );
    expect(mockThinkingSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        currentModel: "gemini-4-argon",
        thinkingLevel: "high",
      })
    );
  });

  it("omits ThinkingLevelSelector when model does not support thinking UI (T5b)", () => {
    mockSupportsThinkingUI.mockReturnValue(false);

    render(
      <InputModelControls
        currentModel="gemini-2.5-flash"
        onSelectModel={vi.fn()}
        isModelAllowed={vi.fn(() => true)}
        thinkingLevel="off"
        setThinkingLevel={vi.fn()}
        disabled={false}
      />
    );

    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    expect(screen.queryByTestId("thinking-selector")).toBeNull();
  });

  it("forwards disabled and expandDown props to child selectors (T5c)", () => {
    mockSupportsThinkingUI.mockReturnValue(true);

    render(
      <InputModelControls
        currentModel="gemini-4-argon"
        onSelectModel={vi.fn()}
        isModelAllowed={vi.fn(() => true)}
        thinkingLevel="medium"
        setThinkingLevel={vi.fn()}
        disabled={true}
        expandDown={true}
      />
    );

    expect(mockModelSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "inline",
        disabled: true,
        expandDown: true,
      })
    );
    expect(mockThinkingSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        expandDown: true,
      })
    );
  });
});
