// src/app/auth/signin/page.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignInPage from "./page";

const mockSignIn = vi.fn();
const mockT = vi.fn((key: string) => key);

vi.mock("./actions", () => ({
  handleGoogleSignIn: () => mockSignIn(),
}));

vi.mock("../../features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => mockT(key),
    langs: ["vi", "en"] as const,
  }),
}));

const RAW_STYLE = /(#[0-9a-fA-F]{3,8}\b|text-white|bg-white|text-\[10px\]|(^|\s)uppercase(\s|$))/;

describe("SignInPage (6B)", () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockT.mockClear();
  });

  it("states encryption at rest, never end-to-end, and signs in with Google (TC-03)", () => {
    render(<SignInPage />);
    expect(screen.getByText("encryptedAtRest")).toBeInTheDocument();
    expect(mockT).not.toHaveBeenCalledWith("encryptedE2E");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "signInWithGoogle" }));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it("uses theme tokens and no styled-jsx block (TC-04)", () => {
    const { container } = render(<SignInPage />);
    // Brand colors inside the Google logo paths are fill attributes, not classes.
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => RAW_STYLE.test(c))).toEqual([]);
    expect(container.querySelector("style")).toBeNull();
  });
});
