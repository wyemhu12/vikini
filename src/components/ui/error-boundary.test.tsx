import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ErrorBoundary } from "./error-boundary";

// Component that throws error on demand
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test intentional error message");
  }
  return <div>Normal Content Rendered</div>;
}

describe("ErrorBoundary UI Component", () => {
  // Silence console.error in tests for expected thrown errors
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(reloadBtn.className).toContain("text-(--accent-foreground)");
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
});
