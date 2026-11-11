// src/app/features/gems/components/GemList.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import GemList from "./GemList";
import type { Gem } from "./GemPreview";

const DICT: Record<string, string> = {
  gemUse: "Dùng Gem",
  libraryInUse: "Đang dùng",
  libraryBuiltIn: "Có sẵn",
  preview: "Xem trước",
  editGem: "Sửa Gem",
  deleteGem: "Xóa Gem",
  messageMoreActions: "Thêm thao tác",
  premadeGems: "Gems hệ thống",
  myGems: "Gems của tôi",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("@/components/ui/DynamicIcon", () => ({
  DynamicIcon: () => <svg data-testid="icon" />,
}));

const PREMADE: Gem = { id: "p1", name: "Biên tập viên", description: "Sửa văn", isPremade: true };
const MINE: Gem = { id: "m1", name: "Kỹ sư Next.js", description: "Viết code" };

function setup(overrides: Partial<React.ComponentProps<typeof GemList>> = {}) {
  const props = {
    loading: false,
    premade: [PREMADE],
    mine: [MINE],
    selectedGemId: "m1",
    canApply: true,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onPreview: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const view = render(<GemList {...props} />);
  return { props, ...view };
}

function openMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name }), { button: 0, ctrlKey: false });
}

describe("GemList (6A)", () => {
  it("renders one primary action per card in a 280px auto-fill grid (TC-04)", () => {
    const { props, container } = setup();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);

    const premadeCard = cards[0];
    const mineCard = cards[1];
    expect(within(premadeCard).getByRole("button", { name: "Dùng Gem" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(within(mineCard).getByRole("button", { name: "Đang dùng" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(premadeCard).getByText("Có sẵn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa Gem" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa Gem" })).toBeNull();
    expect(container.innerHTML).toContain("minmax(280px,1fr)");

    fireEvent.click(within(premadeCard).getByRole("button", { name: "Dùng Gem" }));
    expect(props.onSelect).toHaveBeenCalledWith(PREMADE);
  });

  it("limits built-in gems to Preview and lets my gems be edited or deleted (TC-05)", () => {
    const { props } = setup();
    openMenu("Thêm thao tác: Biên tập viên");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Xem trước"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    openMenu("Thêm thao tác: Kỹ sư Next.js");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Xem trước",
      "Sửa Gem",
      "Xóa Gem",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Xóa Gem" }));
    expect(props.onDelete).toHaveBeenCalledWith(MINE);
  });

  it("previews instead of applying when there is no conversation (TC-08)", () => {
    const { props } = setup({ canApply: false, selectedGemId: null });
    const cards = screen.getAllByRole("article");
    const primary = within(cards[0]).getByRole("button", { name: "Xem trước" });
    expect(primary).not.toHaveAttribute("aria-pressed");
    fireEvent.click(primary);
    expect(props.onPreview).toHaveBeenCalledWith(PREMADE);
    expect(props.onSelect).not.toHaveBeenCalled();
    // Built-in gem: preview is the primary action, so there is nothing left for a menu.
    expect(within(cards[0]).getAllByRole("button")).toHaveLength(1);
    expect(within(cards[1]).getAllByRole("button")).toHaveLength(2);
  });
});
