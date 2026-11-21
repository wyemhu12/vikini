import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import UpgradeModal from "./UpgradeModal";
import { useLanguageStore } from "@/lib/store/languageStore";

describe("UpgradeModal (TC-P5-04)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  it("renders a single localized close button, no dead hover, and --on-accent CTA in English", () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen={true} onClose={onClose} modelName="Gemini 4 Argon" />);

    const closeBtns = screen.getAllByRole("button", { name: /^Close$/i });
    expect(closeBtns).toHaveLength(1);
    expect(closeBtns[0].className).toContain("hover:bg-(--raised-hover)");
    expect(closeBtns[0].className).not.toMatch(/hover:bg-\(--raised\)(?!-)/);

    const cta = screen.getByRole("button", { name: /got it/i });
    expect(cta).toHaveAttribute("type", "button");
    expect(cta.className).toContain("text-(--on-accent)");

    fireEvent.click(cta);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders Vietnamese close label without leaking English 'Close' when language is vi", () => {
    useLanguageStore.setState({ language: "vi" });
    const onClose = vi.fn();
    render(<UpgradeModal isOpen={true} onClose={onClose} modelName="Gemini 4 Argon" />);

    const closeBtns = screen.getAllByRole("button", { name: /^Đóng$/i });
    expect(closeBtns).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Close$/i })).toBeNull();

    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
