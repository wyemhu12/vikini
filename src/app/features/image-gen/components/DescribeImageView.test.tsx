// src/app/features/image-gen/components/DescribeImageView.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DescribeImageView } from "./DescribeImageView";

vi.mock("next/navigation", () => ({
  usePathname: () => "/describe",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../layout/components/AppFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-frame">{children}</div>
  ),
}));

vi.mock("../../chat/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "hoanghon-dark", setTheme: vi.fn() }),
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

describe("DescribeImageView (phase 4 TC-08)", () => {
  it("uses the shared Images header with the Describe tab current", () => {
    render(<DescribeImageView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Ảnh" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mô tả ảnh" })).toHaveAttribute("aria-current", "page");
  });

  it("styles the drop zone with tokens and no uppercase labels", () => {
    const { container } = render(<DescribeImageView />);
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => /(purple|indigo|blue-[0-9])/.test(c))).toEqual([]);
    expect(classes.filter((c) => c.split(/\s+/).includes("uppercase"))).toEqual([]);
  });
});
