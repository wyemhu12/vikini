// src/app/features/gems/components/GemQuickSwitch.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GemQuickSwitch from "./GemQuickSwitch";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = { gemChip: "Gem", selectGem: "Chọn GEM" };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../stores/useGemStore", () => ({
  useGemStore: () => ({ openGemModal: vi.fn(), triggerGemApplied: vi.fn() }),
}));

vi.mock("@/components/ui/DynamicIcon", () => ({
  DynamicIcon: () => <svg data-testid="gem-icon" />,
}));

describe("GemQuickSwitch trigger (TC-17)", () => {
  it("prefixes the active gem name with 'Gem:'", () => {
    render(<GemQuickSwitch currentGem={{ name: "Kỹ sư Next.js" }} conversationId="c1" />);
    const trigger = screen.getByRole("button", { name: "Gem: Kỹ sư Next.js" });
    expect(trigger).not.toHaveAttribute("aria-pressed");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger.className).not.toContain("uppercase");
  });

  it("shows the plain 'Gem' label when no gem is applied", () => {
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    expect(screen.getByRole("button", { name: "Gem" })).toBeInTheDocument();
  });

  it("drops the prefix when showPrefix is false", () => {
    render(
      <GemQuickSwitch
        currentGem={{ name: "Kỹ sư Next.js" }}
        conversationId="c1"
        showPrefix={false}
      />
    );
    expect(screen.getByRole("button", { name: "Kỹ sư Next.js" })).toBeInTheDocument();
  });
});
