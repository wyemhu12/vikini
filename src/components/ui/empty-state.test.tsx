import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { EmptyState } from "./empty-state";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("EmptyState", () => {
  it("TC-03: renders a link action for href", () => {
    render(<EmptyState title="Chưa có ảnh" action={{ label: "Tạo ảnh", href: "/images" }} />);
    expect(screen.getByRole("link", { name: "Tạo ảnh" })).toHaveAttribute("href", "/images");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("TC-03: renders a button action that calls onClick once", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Chưa có ảnh" action={{ label: "Thử lại", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("TC-03: renders no action control when action is omitted", () => {
    render(<EmptyState title="Chưa có ảnh" description="Mô tả" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("TC-04: exposes role=status and never uses sub-12px text", () => {
    const { container } = render(<EmptyState title="Chưa có ảnh" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/text-\[(8|9|10|11)px\]/);
  });
});
