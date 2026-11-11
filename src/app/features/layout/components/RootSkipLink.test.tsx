import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RootSkipLink from "./RootSkipLink";
import { useLanguageStore } from "@/lib/store/languageStore";

let mockPathname = "/images";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("RootSkipLink (TC-6E-03)", () => {
  beforeEach(() => {
    mockPathname = "/images";
    useLanguageStore.setState({ language: "en" });
  });

  it("renders a bilingual skip link to #main on non-workspace routes and updates dynamically", () => {
    render(<RootSkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main");

    act(() => {
      useLanguageStore.getState().setLanguage("vi");
    });

    expect(screen.getByRole("link", { name: "Chuyển tới nội dung chính" })).toHaveAttribute(
      "href",
      "#main"
    );
  });

  it("returns null on workspace routes that already render dedicated skip links", () => {
    for (const route of ["/", "/novelcrafter", "/novelcrafter/prompts"]) {
      mockPathname = route;
      const { container, unmount } = render(<RootSkipLink />);
      expect(container.firstChild).toBeNull();
      unmount();
    }
  });
});
