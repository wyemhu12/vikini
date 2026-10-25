// /lib/features/novelcrafter/selectionBubblePlacement.test.ts
import { describe, expect, it } from "vitest";
import { computeSelectionBubblePosition } from "./selectionBubblePlacement";

describe("selectionBubblePlacement (TC-BUBBLE)", () => {
  const containerRect = { top: 100, left: 200, width: 800, height: 600 };

  it("BB-1: places bubble above selection when there is sufficient space above", () => {
    const pos = computeSelectionBubblePosition({
      selectionRect: { top: 300, left: 500, width: 100, height: 24 },
      containerRect,
      containerScrollTop: 150,
      bubbleWidth: 320,
      bubbleHeight: 40,
      gapPx: 8,
      edgePaddingPx: 12,
    });

    expect(pos.placement).toBe("above");
    expect(pos.top).toBe(300 - 100 + 150 - 40 - 8);
    expect(pos.left).toBe(500 - 200 + 50 - 160);
  });

  it("BB-2: flips bubble below selection when selection is near top edge of container", () => {
    const pos = computeSelectionBubblePosition({
      selectionRect: { top: 115, left: 500, width: 100, height: 24 },
      containerRect,
      containerScrollTop: 0,
      bubbleWidth: 320,
      bubbleHeight: 40,
      gapPx: 8,
      edgePaddingPx: 12,
    });

    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(15 + 24 + 8);
  });

  it("BB-3: clamps horizontal left coordinate within [edgePaddingPx, width - bubbleWidth - edgePaddingPx]", () => {
    const nearLeft = computeSelectionBubblePosition({
      selectionRect: { top: 300, left: 205, width: 20, height: 24 },
      containerRect,
      containerScrollTop: 0,
      bubbleWidth: 320,
      bubbleHeight: 40,
      edgePaddingPx: 12,
    });
    expect(nearLeft.left).toBe(12);

    const nearRight = computeSelectionBubblePosition({
      selectionRect: { top: 300, left: 980, width: 20, height: 24 },
      containerRect,
      containerScrollTop: 0,
      bubbleWidth: 320,
      bubbleHeight: 40,
      edgePaddingPx: 12,
    });
    expect(nearRight.left).toBe(800 - 320 - 12);
  });

  it("BB-4 (Boundary): returns edgePaddingPx and never negative left when container is narrower than bubble", () => {
    const narrow = computeSelectionBubblePosition({
      selectionRect: { top: 300, left: 210, width: 40, height: 24 },
      containerRect: { top: 100, left: 200, width: 260, height: 500 },
      containerScrollTop: 0,
      bubbleWidth: 360,
      bubbleHeight: 40,
      edgePaddingPx: 12,
    });
    expect(narrow.left).toBe(12);
    expect(narrow.left).toBeGreaterThanOrEqual(0);
  });
});
