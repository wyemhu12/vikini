// /app/features/layout/components/AuthShell.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthShell } from "./AuthShell";

const mockSetLanguage = vi.fn();

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: mockSetLanguage,
    t: (key: string) => ({ languageSwitcherLabel: "Ngôn ngữ" })[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

const RAW_STYLE = /(#[0-9a-fA-F]{3,8}\b|text-white|bg-white|text-\[10px\]|(^|\s)uppercase(\s|$))/;

describe("AuthShell (6B)", () => {
  beforeEach(() => mockSetLanguage.mockClear());

  it("offers a labelled language switch with pressed state (TC-01)", () => {
    render(
      <AuthShell>
        <p>Nội dung</p>
      </AuthShell>
    );
    const group = screen.getByRole("group", { name: "Ngôn ngữ" });
    expect(within(group).getByRole("button", { name: "Tiếng Việt" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const english = within(group).getByRole("button", { name: "English" });
    expect(english).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(english);
    expect(mockSetLanguage).toHaveBeenCalledWith("en");
    expect(within(screen.getByRole("main")).getByText("Nội dung")).toBeInTheDocument();
  });

  it("uses theme tokens only (TC-02)", () => {
    const { container } = render(
      <AuthShell>
        <p>Nội dung</p>
      </AuthShell>
    );
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => RAW_STYLE.test(c))).toEqual([]);
  });
});
