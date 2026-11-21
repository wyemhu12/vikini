import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useToastStore, toast } from "./toastStore";

describe("toastStore — timer lifecycle, pause/resume & invariants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearAllToasts();
  });

  afterEach(() => {
    useToastStore.getState().clearAllToasts();
    vi.useRealTimers();
  });

  it("auto-dismisses a normal toast after its duration", () => {
    toast.success("Saved", 3000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("pauses on hover and resumes for only the remaining time", () => {
    const id = useToastStore.getState().addToast("Hello", "info", 5000);

    vi.advanceTimersByTime(2000);
    useToastStore.getState().pauseToast(id);

    // Must NOT expire while hovered even well past original duration
    vi.advanceTimersByTime(10_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    // Resume: should expire after the remaining 3000ms
    useToastStore.getState().resumeToast(id);
    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("Negative Probe #3a: does not dismiss toasts while tab is hidden (visibilityPaused)", () => {
    useToastStore.getState().addToast("Before hide", "info", 5000);
    vi.advanceTimersByTime(1000);

    useToastStore.getState().setVisibilityPaused(true);
    vi.advanceTimersByTime(10_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().setVisibilityPaused(false);
    vi.advanceTimersByTime(3999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("Negative Probe #3b: addToast while visibilityPaused=true does not schedule timer until visible", () => {
    useToastStore.getState().setVisibilityPaused(true);
    useToastStore.getState().addToast("Background error", "error", 5000);

    vi.advanceTimersByTime(20_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().setVisibilityPaused(false);
    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("Negative Probe #3c: setVisibilityPaused(false) does not resume a toast that is hover-paused", () => {
    const id = useToastStore.getState().addToast("Hovered", "warning", 5000);
    useToastStore.getState().pauseToast(id);
    useToastStore.getState().setVisibilityPaused(true);
    useToastStore.getState().setVisibilityPaused(false);

    vi.advanceTimersByTime(10_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("Negative Probe #3d: sticky toast (duration <= 0) survives pauseToast -> resumeToast", () => {
    const id = useToastStore.getState().addToast("Sticky", "info", 0);
    useToastStore.getState().pauseToast(id);
    useToastStore.getState().resumeToast(id);
    useToastStore.getState().setVisibilityPaused(true);
    useToastStore.getState().setVisibilityPaused(false);

    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("safely ignores pauseToast/resumeToast/removeToast on unknown ids", () => {
    expect(() => {
      useToastStore.getState().pauseToast("missing");
      useToastStore.getState().resumeToast("missing");
      useToastStore.getState().removeToast("missing");
    }).not.toThrow();
  });
});
