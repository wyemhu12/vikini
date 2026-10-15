// /lib/features/novelcrafter/quoteScrollPositioning.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  computeQuoteScrollTop,
  measureCaretOffsetTop,
  MIRROR_STYLE_PROPERTIES,
} from "./quoteScrollPositioning";

describe("quoteScrollPositioning (TC-04, TC-05)", () => {
  it("TC-04: computes Golden Third scroll top and clamps negative values to 0", () => {
    expect(MIRROR_STYLE_PROPERTIES).toHaveLength(24);

    const target = computeQuoteScrollTop({
      textareaRectTop: 100,
      containerRectTop: 50,
      containerScrollTop: 200,
      quoteOffsetTop: 800,
      containerClientHeight: 900,
    });
    // textareaTopInScrollContent = 100 - 50 + 200 = 250
    // viewportPadding = Math.min(220, Math.max(100, 900 * 0.3 = 270)) = 220
    // targetTop = 250 + 800 - 220 = 830
    expect(target).toBe(830);

    const clamped = computeQuoteScrollTop({
      textareaRectTop: 10,
      containerRectTop: 50,
      containerScrollTop: 0,
      quoteOffsetTop: 20,
      containerClientHeight: 600,
    });
    expect(clamped).toBe(0);
  });

  it("TC-05: copies 24 style properties and removes temporary mirror node in finally even on error", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "First paragraph.\n\nSecond paragraph with highlighted quote.";
    document.body.appendChild(textarea);

    const initialChildCount = document.body.childElementCount;
    const offset = measureCaretOffsetTop(textarea, 18);
    expect(typeof offset).toBe("number");
    expect(document.body.childElementCount).toBe(initialChildCount);

    // Simulate error when reading marker.offsetTop and verify cleanup still runs
    const spy = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementationOnce(() => {
      throw new Error("Simulated layout error");
    });

    expect(() => measureCaretOffsetTop(textarea, 10)).toThrow("Simulated layout error");
    expect(document.body.childElementCount).toBe(initialChildCount);

    spy.mockRestore();
    document.body.removeChild(textarea);
  });
});
