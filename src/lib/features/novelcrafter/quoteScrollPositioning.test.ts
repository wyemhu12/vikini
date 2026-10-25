// /lib/features/novelcrafter/quoteScrollPositioning.test.ts
import { describe, expect, it } from "vitest";
import * as quoteScrollModule from "./quoteScrollPositioning";
import { computeQuoteScrollTop } from "./quoteScrollPositioning";

describe("quoteScrollPositioning (TC-SCROLL)", () => {
  it("SC-1: computes Golden Third scroll top from targetRectTop and container metrics", () => {
    const scrollTop = computeQuoteScrollTop({
      targetRectTop: 900,
      containerRectTop: 100,
      containerScrollTop: 200,
      containerClientHeight: 600,
    });
    // targetTopInScrollContent = 900 - 100 + 200 = 1000
    // viewportPadding = Math.min(220, Math.max(100, Math.round(600 * 0.3))) = 180
    // scrollTop = 1000 - 180 = 820
    expect(scrollTop).toBe(820);
  });

  it("SC-2: clamps negative scroll top values to 0", () => {
    const clamped = computeQuoteScrollTop({
      targetRectTop: 110,
      containerRectTop: 100,
      containerScrollTop: 0,
      containerClientHeight: 600,
    });
    expect(clamped).toBe(0);
  });

  it("SC-3: clamps Golden Third viewport padding between 100px (small height) and 220px (large height)", () => {
    const smallHeight = computeQuoteScrollTop({
      targetRectTop: 500,
      containerRectTop: 100,
      containerScrollTop: 0,
      containerClientHeight: 200, // 200 * 0.3 = 60 -> clamped to 100
    });
    expect(smallHeight).toBe(400 - 100);

    const largeHeight = computeQuoteScrollTop({
      targetRectTop: 500,
      containerRectTop: 100,
      containerScrollTop: 0,
      containerClientHeight: 2000, // 2000 * 0.3 = 600 -> clamped to 220
    });
    expect(largeHeight).toBe(400 - 220);
  });

  it("SC-4 (Negative): does not export legacy measureCaretOffsetTop or MIRROR_STYLE_PROPERTIES", () => {
    const exportedKeys = Object.keys(quoteScrollModule);
    expect(exportedKeys).not.toContain("measureCaretOffsetTop");
    expect(exportedKeys).not.toContain("MIRROR_STYLE_PROPERTIES");
  });
});
