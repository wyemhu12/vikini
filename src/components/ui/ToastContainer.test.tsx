import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ToastContainer from "./ToastContainer";
import { useToastStore } from "@/lib/store/toastStore";

vi.mock("@/app/features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: "vi",
  }),
}));

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearAllToasts();
  });

  afterEach(() => {
    useToastStore.getState().clearAllToasts();
    vi.useRealTimers();
  });

  it("renders opaque bg-(--surface) toasts constrained for 375px mobile", () => {
    useToastStore.getState().addToast("Operation failed", "error", 5000);
    render(<ToastContainer />);

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-(--surface)");
    expect(alert.className).not.toContain("bg-(--danger)/10");
    expect(alert.className).toContain("max-w-[calc(100vw-2rem)]");
    expect(alert.className).toContain("toast-enter");
    expect(screen.getByText("Operation failed")).toBeInTheDocument();
  });

  it("pauses dismissal on hover and ignores internal blur within the same toast", () => {
    useToastStore.getState().addToast("Hover me", "info", 3000);
    render(<ToastContainer />);

    const alert = screen.getByRole("alert");
    const dismissBtn = screen.getByRole("button", { name: "dismissNotification" });

    fireEvent.focus(alert);
    // Internal focus move to child button must NOT resume timer
    fireEvent.blur(alert, { relatedTarget: dismissBtn });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Blur outside toast resumes dismissal
    fireEvent.blur(alert, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses when close button is clicked and syncs visibilitychange", () => {
    useToastStore.getState().addToast("Closable", "success", 5000);
    render(<ToastContainer />);

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    fireEvent.click(screen.getByRole("button", { name: "dismissNotification" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
