// /lib/features/novelcrafter/studioLayout.test.ts
import { describe, expect, it } from "vitest";
import {
  applyDockedPaneToggle,
  resolveInitialDockedPanes,
  resolveStudioLayout,
} from "./studioLayout";

describe("studioLayout (TC-LAYOUT)", () => {
  it("LY-1..LY-8: resolves 4-tier responsive studio layout and maxDockedSidePanes across all viewport widths", () => {
    // LY-1: 390px mobile
    const ly1 = resolveStudioLayout(390);
    expect(ly1.maxDockedSidePanes).toBe(0);
    expect(ly1.allowDualDockedSidebars).toBe(false);
    expect(ly1.feedbackGutterMode).toBe("bottom-sheet");

    // LY-2: 900px tablet
    const ly2 = resolveStudioLayout(900);
    expect(ly2.maxDockedSidePanes).toBe(0);
    expect(ly2.allowDualDockedSidebars).toBe(false);
    expect(ly2.feedbackGutterMode).toBe("sheet");

    // LY-3: 1366px laptop
    const ly3 = resolveStudioLayout(1366);
    expect(ly3.maxDockedSidePanes).toBe(1);
    expect(ly3.allowDualDockedSidebars).toBe(false);
    expect(ly3.feedbackGutterMode).toBe("docked");

    // LY-4: 1440px laptop
    const ly4 = resolveStudioLayout(1440);
    expect(ly4.maxDockedSidePanes).toBe(1);
    expect(ly4.allowDualDockedSidebars).toBe(false);
    expect(ly4.feedbackGutterMode).toBe("docked");

    // LY-5: 1535px vs 1536px boundary
    const ly5a = resolveStudioLayout(1535);
    expect(ly5a.maxDockedSidePanes).toBe(1);
    expect(ly5a.allowDualDockedSidebars).toBe(false);
    expect(ly5a.feedbackGutterMode).toBe("docked");

    const ly5b = resolveStudioLayout(1536);
    expect(ly5b.maxDockedSidePanes).toBe(2);
    expect(ly5b.allowDualDockedSidebars).toBe(true);
    expect(ly5b.feedbackGutterMode).toBe("docked");

    // LY-6: 1920px Full HD
    const ly6 = resolveStudioLayout(1920);
    expect(ly6.maxDockedSidePanes).toBe(3);
    expect(ly6.allowDualDockedSidebars).toBe(true);
    expect(ly6.feedbackGutterMode).toBe("docked");

    // LY-7: 2560px QHD
    const ly7 = resolveStudioLayout(2560);
    expect(ly7.maxDockedSidePanes).toBe(3);
    expect(ly7.allowDualDockedSidebars).toBe(true);
    expect(ly7.feedbackGutterMode).toBe("docked");

    // LY-8: Invalid widths fallback to 1280 -> maxDockedSidePanes = 1
    for (const bad of [Number.NaN, -1, 0]) {
      const fallback = resolveStudioLayout(bad);
      expect(fallback.maxDockedSidePanes).toBe(1);
      expect(fallback.allowDualDockedSidebars).toBe(false);
      expect(fallback.feedbackGutterMode).toBe("docked");
    }
  });

  it("LY-9..LY-13: enforces LRU mutual exclusion in applyDockedPaneToggle and resolveInitialDockedPanes", () => {
    // LY-9
    expect(applyDockedPaneToggle(["navigator"], "history", 1)).toEqual(["history"]);

    // LY-10
    expect(applyDockedPaneToggle(["navigator", "history"], "feedback", 2)).toEqual([
      "history",
      "feedback",
    ]);

    // LY-11
    expect(applyDockedPaneToggle(["navigator"], "navigator", 1)).toEqual([]);

    // LY-12 (Negative: max = 0 prevents docking)
    expect(applyDockedPaneToggle([], "navigator", 0)).toEqual([]);
    expect(applyDockedPaneToggle(["navigator"], "history", 0)).toEqual([]);

    // LY-13
    expect(resolveInitialDockedPanes(0)).toEqual([]);
    expect(resolveInitialDockedPanes(1)).toEqual(["navigator"]);
    expect(resolveInitialDockedPanes(2)).toEqual(["navigator", "history"]);
    expect(resolveInitialDockedPanes(3)).toEqual(["navigator", "history"]);
  });
});
