import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardView, { toSingleLinePreview } from "./DashboardView";
import { useLanguageStore } from "@/lib/store/languageStore";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Minh Anh" } } }),
}));

describe("DashboardView — bilingual prompts & hover anti-oscillation", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "vi" });
  });

  it("toSingleLinePreview flattens multiline prompts into a single line", () => {
    expect(toSingleLinePreview("Review và tối ưu đoạn code sau:\n\n")).toBe(
      "Review và tối ưu đoạn code sau:"
    );
    expect(toSingleLinePreview("Line 1\n\n  Line 2\nLine 3")).toBe("Line 1 Line 2 Line 3");
  });

  it("TC-P1-03: sends single-line Vietnamese preview on hover, full multiline Vietnamese prompt on click, and labels close button", () => {
    const onPromptPreview = vi.fn();
    const onPromptSelect = vi.fn();
    render(<DashboardView onPromptPreview={onPromptPreview} onPromptSelect={onPromptSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();

    const reviewBtn = screen.getByRole("button", { name: "Review và tối ưu code" });
    fireEvent.mouseEnter(reviewBtn);

    const previewArg = onPromptPreview.mock.calls.at(-1)?.[0] as string;
    expect(previewArg).toContain("Review và tối ưu đoạn code sau:");
    expect(previewArg).not.toContain("\n");

    fireEvent.click(reviewBtn);
    expect(onPromptSelect).toHaveBeenCalledWith("Review và tối ưu đoạn code sau:\n\n");
  });

  it("uses English prompt templates when language is English", () => {
    useLanguageStore.setState({ language: "en" });
    const onPromptSelect = vi.fn();
    render(<DashboardView onPromptSelect={onPromptSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Review and optimize code" }));
    expect(onPromptSelect).toHaveBeenCalledWith("Review and optimize this code:\n\n");
  });
});
