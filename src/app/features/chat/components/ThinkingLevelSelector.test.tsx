// src/app/features/chat/components/ThinkingLevelSelector.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ThinkingLevelSelector from "./ThinkingLevelSelector";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        thinkingLevel: "Suy luận",
        thinkingLevelTooltip: "Điều chỉnh độ sâu suy luận của AI",
        thinkingOff: "Tắt",
        thinkingLevelLow: "Nhanh",
        thinkingLevelMedium: "Vừa",
        thinkingLevelHigh: "Sâu",
        thinkingLevelMinimal: "Tối thiểu",
      };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

describe("ThinkingLevelSelector", () => {
  it("renders a desktop-only chip labelled with the current level (TC-15)", () => {
    render(
      <ThinkingLevelSelector
        thinkingLevel="medium"
        setThinkingLevel={vi.fn()}
        currentModel="gemini-3.8-flash"
      />
    );
    const trigger = screen.getByRole("button", { name: "Suy luận: Vừa" });
    expect(trigger).toHaveTextContent("Suy luận: Vừa");
    expect(trigger.className).toContain("hidden");
    expect(trigger.className).toContain("@3xl/chat:inline-flex");
    expect(trigger).not.toHaveAttribute("aria-pressed");
    expect(trigger.className).not.toContain("uppercase");
  });

  it("lists levels without uppercase styling and selects a level (TC-16)", () => {
    const setThinkingLevel = vi.fn();
    render(
      <ThinkingLevelSelector
        thinkingLevel="medium"
        setThinkingLevel={setThinkingLevel}
        currentModel="gemini-3.8-flash"
      />
    );
    const trigger = screen.getByRole("button", { name: "Suy luận: Vừa" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Tắt", "Nhanh", "Vừa", "Sâu"]);
    for (const item of items) {
      expect(item.innerHTML).not.toContain("uppercase");
    }
    fireEvent.click(screen.getByRole("menuitem", { name: "Sâu" }));
    expect(setThinkingLevel).toHaveBeenCalledWith("high");
  });
});
