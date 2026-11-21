import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ModelSelector from "./ModelSelector";

let mockIsDesktop = true;
vi.mock("../../layout/hooks/useIsDesktop", () => ({
  useIsDesktop: () => mockIsDesktop,
}));

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({ t: (k: string) => k, language: "vi" }),
}));

vi.mock("../hooks/useLocalLlmHealth", () => ({
  useLocalLlmHealth: () => ({ status: "hidden" }),
}));

describe("ModelSelector", () => {
  beforeEach(() => {
    mockIsDesktop = true;
  });

  it("TC-P2-02: resolves legacy model slug 'gemini-2.5-flash' via resolveChatModelDisplay", () => {
    render(
      <ModelSelector
        currentModelId="gemini-2.5-flash"
        onSelectModel={vi.fn()}
        isModelAllowed={() => true}
        disabled={false}
        variant="inline"
      />
    );

    const btn = screen.getByRole("button", { name: /Gemini 3\.5 Flash-Lite/i });
    expect(btn).toBeInTheDocument();
    expect(screen.queryByText("gemini-2.5-flash")).toBeNull();
    expect(btn.className).toContain("min-w-0");
    expect(btn.className).toContain("max-w-full");
  });

  it("uses native button SheetTrigger on mobile without wrapping <span onClick>", () => {
    mockIsDesktop = false;
    const { container } = render(
      <ModelSelector
        currentModelId="gemini-2.5-flash"
        onSelectModel={vi.fn()}
        isModelAllowed={() => true}
        disabled={false}
        variant="inline"
      />
    );

    expect(container.querySelector("span.contents")).toBeNull();
    const trigger = screen.getByRole("button", { name: /Gemini 3\.5 Flash-Lite/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
