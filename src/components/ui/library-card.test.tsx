// src/components/ui/library-card.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LibraryCard } from "./library-card";

function openMenu(name: string | RegExp) {
  fireEvent.pointerDown(screen.getByRole("button", { name }), { button: 0, ctrlKey: false });
}

describe("LibraryCard", () => {
  it("reflects selection on the primary button and card (TC-01)", () => {
    const onPrimary = vi.fn();
    const { rerender, container } = render(
      <LibraryCard
        title="Kỹ sư Next.js với một cái tên rất dài"
        primaryLabel="Dùng Gem"
        onPrimary={onPrimary}
        selected={false}
      />
    );
    const primary = screen.getByRole("button", { name: "Dùng Gem" });
    expect(primary).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(primary);
    expect(onPrimary).toHaveBeenCalledTimes(1);
    const heading = screen.getByRole("heading", { name: "Kỹ sư Next.js với một cái tên rất dài" });
    expect(heading.className).not.toContain("truncate");
    expect(heading.className).toContain("line-clamp-2");

    rerender(<LibraryCard title="Kỹ sư" primaryLabel="Đang dùng" onPrimary={onPrimary} selected />);
    expect(screen.getByRole("button", { name: "Đang dùng" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(container.querySelector("article")?.className).toContain("border-(--accent)");
  });

  it("omits aria-pressed when selection does not apply", () => {
    render(<LibraryCard title="Kỹ sư" primaryLabel="Xem trước" onPrimary={vi.fn()} />);
    const primary = screen.getByRole("button", { name: "Xem trước" });
    expect(primary).not.toHaveAttribute("aria-pressed");
    // Not the page's key action in this mode: outline, not accent.
    expect(primary.className).not.toContain("bg-(--accent)");
  });

  it("puts destructive items last, after a separator (TC-02)", () => {
    const onPreview = vi.fn();
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    render(
      <LibraryCard
        title="Kỹ sư"
        primaryLabel="Dùng Gem"
        onPrimary={vi.fn()}
        menuLabel="Thêm thao tác: Kỹ sư"
        menuItems={[
          { label: "Xem trước", onSelect: onPreview },
          { label: "Xóa Gem", onSelect: onDelete, danger: true },
          { label: "Sửa Gem", onSelect: onEdit },
        ]}
      />
    );
    openMenu("Thêm thao tác: Kỹ sư");
    const menu = screen.getByRole("menu");
    const order = Array.from(menu.querySelectorAll('[role="menuitem"], [role="separator"]')).map(
      (el) => (el.getAttribute("role") === "separator" ? "---" : el.textContent)
    );
    expect(order).toEqual(["Xem trước", "Sửa Gem", "---", "Xóa Gem"]);
    const del = screen.getByRole("menuitem", { name: "Xóa Gem" });
    expect(del.className).toContain("text-(--danger)");
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onPreview).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("renders no menu button without menu items (TC-03)", () => {
    render(
      <LibraryCard title="Kỹ sư" primaryLabel="Dùng Gem" onPrimary={vi.fn()} menuItems={[]} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
