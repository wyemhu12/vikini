// src/app/auth/error/page.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AuthErrorPage from "./page";

const mockSignOut = vi.fn();
let mockError: string | null = null;

vi.mock("next-auth/react", () => ({
  signOut: (opts: unknown) => mockSignOut(opts),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "error" ? mockError : null) }),
}));

vi.mock("../../features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

const RAW_STYLE = /(#[0-9a-fA-F]{3,8}\b|text-white|bg-white|text-\[10px\]|(^|\s)uppercase(\s|$))/;

describe("AuthErrorPage (6B)", () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockError = null;
  });

  it("explains a denied sign-in inside an alert and returns to sign-in (TC-05, Loại C)", () => {
    render(<AuthErrorPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "authErrorDeniedTitle" })
    ).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByText("authErrorDeniedDesc")).toBeInTheDocument();
    expect(
      within(screen.getByRole("alert")).getByText("authErrorAllowlistHint")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "authErrorBackToSignIn" }));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/auth/signin" });
  });

  it("shows the blocked-account message for error=blocked (TC-05, Loại C)", () => {
    mockError = "blocked";
    render(<AuthErrorPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "authErrorBlockedTitle" })
    ).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByText("authErrorBlockedDesc")).toBeInTheDocument();
  });

  it("uses theme tokens and no styled-jsx block (TC-06)", () => {
    const { container } = render(<AuthErrorPage />);
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => RAW_STYLE.test(c))).toEqual([]);
    expect(container.querySelector("style")).toBeNull();
  });
});
