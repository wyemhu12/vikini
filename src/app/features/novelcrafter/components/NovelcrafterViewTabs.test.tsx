// /app/features/novelcrafter/components/NovelcrafterViewTabs.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NovelcrafterViewTabs, type NovelcrafterViewIds } from "./NovelcrafterViewTabs";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        novelcrafterViewTabs: "Chế độ xem",
        novelcrafterViewWrite: "Viết",
        novelcrafterViewOutline: "Dàn ý",
        novelcrafterViewBible: "Hồ sơ",
      })[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

const IDS: NovelcrafterViewIds = {
  tab: (v) => `tab-${v}`,
  panel: (v) => `panel-${v}`,
};

describe("NovelcrafterViewTabs (5B)", () => {
  it("exposes a named tablist with the current tab selected (TC-03)", () => {
    const onChange = vi.fn();
    render(<NovelcrafterViewTabs value="outline" onChange={onChange} ids={IDS} />);
    expect(screen.getByRole("tablist", { name: "Chế độ xem" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Viết", "Dàn ý", "Hồ sơ"]);

    const outline = screen.getByRole("tab", { name: "Dàn ý" });
    expect(outline).toHaveAttribute("aria-selected", "true");
    expect(outline).toHaveAttribute("tabindex", "0");
    expect(outline).toHaveAttribute("id", "tab-outline");
    expect(outline).toHaveAttribute("aria-controls", "panel-outline");
    for (const tab of tabs.filter((t) => t !== outline)) {
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab).toHaveAttribute("tabindex", "-1");
    }

    fireEvent.click(screen.getByRole("tab", { name: "Hồ sơ" }));
    expect(onChange).toHaveBeenCalledWith("bible");
  });

  it("moves between tabs with arrows, Home and End (TC-04)", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NovelcrafterViewTabs value="bible" onChange={onChange} ids={IDS} />
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: "Hồ sơ" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("write");

    rerender(<NovelcrafterViewTabs value="write" onChange={onChange} ids={IDS} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Viết" }), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("bible");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Viết" }), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("bible");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Viết" }), { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("write");
  });
});
