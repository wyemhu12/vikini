import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatControls from "./ChatControls";

vi.mock("./InputForm", () => ({
  default: () => <div data-testid="mock-input-form">InputForm</div>,
}));

vi.mock("./InputModelControls", () => ({
  default: () => <div data-testid="mock-model-controls" />,
}));

vi.mock("./ComposerLeadingControls", () => ({
  default: () => <div data-testid="mock-leading-controls" />,
}));

const baseProps = {
  currentModel: "gemini-2.5-flash",
  handleModelChange: vi.fn(),
  isModelAllowed: () => true,
  webSearchEnabled: false,
  toggleWebSearch: vi.fn(),
  alwaysSearch: false,
  toggleAlwaysSearch: vi.fn(),
  thinkingLevel: "off" as const,
  setThinkingLevel: vi.fn(),
  currentGem: null,
  currentPersona: null,
  input: "",
  setInput: vi.fn(),
  handleSend: vi.fn(),
  handleStop: vi.fn(),
  isStreaming: false,
  regenerating: false,
  creatingConversation: false,
  streamingAssistant: null,
  selectedConversationId: null,
  onImageGen: vi.fn(),
};

describe("ChatControls horizon glow (TC-6E-07)", () => {
  it("renders a pointer-events-none aria-hidden composer-horizon-glow backdrop in both standard and landing modes", () => {
    const { rerender } = render(<ChatControls {...baseProps} isLanding={false} />);

    const glow = screen.getByTestId("composer-horizon-glow");
    expect(glow).toHaveAttribute("aria-hidden", "true");
    expect(glow.className).toContain("pointer-events-none");
    expect(glow.className).toContain("composer-horizon-glow");

    rerender(<ChatControls {...baseProps} isLanding={true} />);
    const landingGlow = screen.getByTestId("composer-horizon-glow");
    expect(landingGlow).toHaveAttribute("aria-hidden", "true");
    expect(landingGlow.className).toContain("pointer-events-none");
    expect(landingGlow.className).toContain("composer-horizon-glow");
  });
});
