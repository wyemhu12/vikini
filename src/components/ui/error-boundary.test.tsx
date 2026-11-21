import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ErrorBoundary } from "./error-boundary";
import { useLanguageStore } from "@/lib/store/languageStore";

// Component that throws error on demand
function ThrowError({
  shouldThrow,
  message = "Test intentional error message",
}: {
  shouldThrow: boolean;
  message?: string;
}) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>Normal Content Rendered</div>;
}

describe("ErrorBoundary UI Component", () => {
  // Silence console.error in tests for expected thrown errors
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.restoreAllMocks();
  });

  it("renders children normally when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Hello Protected App</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Hello Protected App")).toBeInTheDocument();
  });

  it("renders error fallback with accessible buttons and accent-foreground styling on error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Shows error message
    expect(screen.getByText("Test intentional error message")).toBeInTheDocument();

    // Verify Action buttons
    const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
    const reloadBtn = screen.getByRole("button", { name: /reload page/i });

    expect(tryAgainBtn).toBeInTheDocument();
    expect(reloadBtn).toBeInTheDocument();

    // Verify accessible focus rings
    expect(tryAgainBtn.className).toContain("focus-visible:ring-2");
    expect(reloadBtn.className).toContain("focus-visible:ring-2");

    // Verify WCAG AA accent foreground token rather than raw text-white
    expect(reloadBtn.className).toContain("text-(--on-accent)");
    expect(reloadBtn.className).not.toContain("text-white");
  });

  it("renders custom fallback node when provided as prop", () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error Screen</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.queryByText("Test intentional error message")).not.toBeInTheDocument();
  });

  it("calls onReset callback when Try Again button is clicked", () => {
    const onResetMock = vi.fn();
    render(
      <ErrorBoundary onReset={onResetMock}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(tryAgainBtn);

    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it("TC-P5-06: localizes automatically via useLanguageStore in Vietnamese with role='alert' and hover:bg-(--raised-hover)", () => {
    useLanguageStore.setState({ language: "vi" });
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} message="" />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Đã xảy ra lỗi")).toBeInTheDocument();
    expect(
      screen.getByText("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.")
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "Thử lại" });
    expect(retryBtn).toHaveAttribute("type", "button");
    expect(retryBtn.className).toContain("hover:bg-(--raised-hover)");
    expect(retryBtn.className).not.toMatch(/hover:bg-\(--raised\)(?!-)/);

    const reloadBtn = screen.getByRole("button", { name: "Tải lại trang" });
    expect(reloadBtn).toHaveAttribute("type", "button");
  });

  it("TC-P5-06: respects explicit t prop override when provided", () => {
    const customT = (key: string) => `custom:${key}`;
    render(
      <ErrorBoundary t={customT}>
        <ThrowError shouldThrow={true} message="" />
      </ErrorBoundary>
    );

    expect(screen.getByText("custom:errorBoundaryTitle")).toBeInTheDocument();
    expect(screen.getByText("custom:errorBoundaryDescription")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "custom:tryAgain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "custom:reloadPage" })).toBeInTheDocument();
  });
});
