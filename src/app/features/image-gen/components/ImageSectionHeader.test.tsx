// src/app/features/image-gen/components/ImageSectionHeader.test.tsx
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageSectionHeader } from "./ImageSectionHeader";

let mockPathname = "/gallery";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        imagesTitle: "Ảnh",
        imageSectionNav: "Chế độ ảnh",
        imageTabCreate: "Tạo ảnh",
        imageTabLibrary: "Thư viện",
        imageTabDescribe: "Mô tả ảnh",
      })[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("ImageSectionHeader", () => {
  beforeEach(() => {
    mockPathname = "/gallery";
  });

  it("renders the section h1 and marks the current tab (TC-01)", () => {
    render(<ImageSectionHeader />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Ảnh" })).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Chế độ ảnh" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/images", "/gallery", "/describe"]);
    expect(within(nav).getByRole("link", { name: "Thư viện" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).getByRole("link", { name: "Tạo ảnh" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Mô tả ảnh" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks no tab for an unrelated path (TC-02)", () => {
    mockPathname = "/images/abc";
    render(<ImageSectionHeader />);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-current");
      expect(link.className).toContain("border-transparent");
    }
  });

  it("is compact on mobile and keeps the h1 for screen readers (TC-13)", () => {
    const { container } = render(<ImageSectionHeader />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("h-12");
    expect(header?.className).toContain("md:h-15");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("sr-only");
    expect(h1.className).toContain("md:not-sr-only");
  });
});
