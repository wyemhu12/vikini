// /app/features/novelcrafter/hooks/useSelectionBubblePosition.test.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSelectionBubblePosition } from "./useSelectionBubblePosition";

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("useSelectionBubblePosition", () => {
  afterEach(() => vi.restoreAllMocks());

  it("TC-U17: places the bubble above the selection, hides it when the selection leaves the box, and cleans up listeners", () => {
    let selection = rect(400, 300, 120, 20);
    const boundary = rect(200, 100, 900, 600);
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { result, unmount } = renderHook(() =>
      useSelectionBubblePosition({
        enabled: true,
        getSelectionRect: () => selection,
        getBoundaryRect: () => boundary,
        bubbleWidth: 440,
        bubbleHeight: 44,
        updateKey: "sel-1",
      })
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.placement).toBe("above");
    expect(result.current!.top).toBeLessThan(400);

    selection = rect(1200, 300, 120, 20);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBeNull();

    unmount();
    const removed = removeSpy.mock.calls.map((call) => call[0]);
    expect(removed).toContain("scroll");
    expect(removed).toContain("resize");
  });

  it("TC-U18: returns null and attaches no listeners when disabled (docked-bottom mode)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { result } = renderHook(() =>
      useSelectionBubblePosition({
        enabled: false,
        getSelectionRect: () => rect(400, 300, 120, 20),
        getBoundaryRect: () => rect(200, 100, 900, 600),
        bubbleWidth: 440,
        bubbleHeight: 44,
        updateKey: "sel-1",
      })
    );
    expect(result.current).toBeNull();
    const added = addSpy.mock.calls.map((call) => call[0]);
    expect(added).not.toContain("scroll");
    expect(added).not.toContain("resize");
  });
});
