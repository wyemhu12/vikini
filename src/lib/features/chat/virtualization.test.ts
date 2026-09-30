import { describe, it, expect } from "vitest";
import {
  createSizeCache,
  computeVisibleRange,
  calculateVirtualPadding,
  computeScrollCompensation,
} from "./virtualization";

describe("Virtualization Module", () => {
  describe("Size Cache (TC-03a)", () => {
    it("manages item measurements, fallbacks and prefix sums accurately", () => {
      const cache = createSizeCache(100);

      cache.set(0, 150);
      cache.set(1, 300);

      // get measured vs fallback
      expect(cache.get(0)).toBe(150);
      expect(cache.get(1)).toBe(300);
      expect(cache.get(2)).toBe(100); // fallback estimated height

      // Prefix sum: sum of items 0 and 1 = 150 + 300 = 450
      expect(cache.getPrefixSum(2)).toBe(450);

      // Total height for 3 items: 150 + 300 + 100 = 550
      expect(cache.getTotalHeight(3)).toBe(550);

      // Clearing cache
      cache.clear();
      expect(cache.get(0)).toBe(100);
    });
  });

  describe("Windowing & Dynamic Padding (TC-03b)", () => {
    it("computes visible range and padding within [0, totalCount-1] bounds", () => {
      const cache = createSizeCache(100); // 100px per item
      const totalCount = 100; // total 10,000px

      // scrollTop = 1000 -> item 10 is at 1000px
      // viewportHeight = 600 -> items 10 to 15 (1000 to 1600px)
      // overscan = 3 -> start = 10 - 3 = 7, end = 15 + 3 = 18
      const range = computeVisibleRange(1000, 600, totalCount, cache, 3);
      expect(range.startIndex).toBe(7);
      expect(range.endIndex).toBe(18);

      // Padding top should be prefixSum(7) = 7 * 100 = 700
      // Rendered ends at index 18 (bottom is at prefixSum(19) = 1900)
      // Padding bottom should be totalHeight(100) - prefixSum(19) = 10000 - 1900 = 8100
      const padding = calculateVirtualPadding(range.startIndex, range.endIndex, totalCount, cache);
      expect(padding.paddingTop).toBe(700);
      expect(padding.paddingBottom).toBe(8100);
      expect(padding.paddingTop + (18 - 7 + 1) * 100 + padding.paddingBottom).toBe(10000);
    });

    it("handles empty list edge cases safely without errors", () => {
      const cache = createSizeCache(100);
      const range = computeVisibleRange(0, 500, 0, cache, 3);
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(0);

      const padding = calculateVirtualPadding(0, 0, 0, cache);
      expect(padding.paddingTop).toBe(0);
      expect(padding.paddingBottom).toBe(0);
    });
  });

  describe("Scroll Compensation (TC-03c)", () => {
    it("compensates scroll offset when resized item is above visible viewport", () => {
      // Case 1: resizedIndex < startIndex
      const compensation = computeScrollCompensation(2, 5, 80);
      expect(compensation).toBe(80);
    });

    it("does NOT compensate scroll offset when resized item is at or below visible viewport", () => {
      // Case 2: resizedIndex >= startIndex (e.g. streaming assistant message at bottom)
      const compensationAfter = computeScrollCompensation(7, 5, 80);
      expect(compensationAfter).toBe(0);

      const compensationEqual = computeScrollCompensation(5, 5, 80);
      expect(compensationEqual).toBe(0);
    });
  });
});
