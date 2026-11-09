import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PageHeader } from "./page-header";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("PageHeader", () => {
  it("TC-01: renders a single h1 with description and actions inside the header", () => {
    const { container } = render(
      <PageHeader
        title="Thư viện"
        description="Ảnh đã tạo"
        actions={<button type="button">So sánh</button>}
      />
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Thư viện");
    expect(screen.getByText("Ảnh đã tạo")).toBeInTheDocument();
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header).toContainElement(screen.getByRole("button", { name: "So sánh" }));
  });

  it("TC-02: renders the back link only when backHref is provided", () => {
    const { rerender } = render(<PageHeader title="Dự án" backHref="/" backLabel="Quay lại" />);
    const back = screen.getByRole("link", { name: "Quay lại" });
    expect(back).toHaveAttribute("href", "/");

    rerender(<PageHeader title="Dự án" backLabel="Quay lại" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
