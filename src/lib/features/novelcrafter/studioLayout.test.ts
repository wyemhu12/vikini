// /lib/features/novelcrafter/studioLayout.test.ts
import { describe, expect, it } from "vitest";
import { resolveStudioLayout } from "./studioLayout";

describe("studioLayout", () => {
  it("TC-13: resolves compact layout for narrow mobile and Galaxy Z Fold cover screens (<640px)", () => {
    const foldCover = resolveStudioLayout(412);
    expect(foldCover.tier).toBe("compact");
    expect(foldCover.leftPaneMode).toBe("sheet");
    expect(foldCover.rightPaneMode).toBe("bottom-sheet");
    expect(foldCover.feedbackGutterMode).toBe("bottom-sheet");
    expect(foldCover.allowDualDockedSidebars).toBe(false);
  });

  it("TC-14: resolves medium layout for foldable inner displays and tablets (640-1179px)", () => {
    const foldInner = resolveStudioLayout(900);
    expect(foldInner.tier).toBe("medium");
    expect(foldInner.leftPaneMode).toBe("sheet");
    expect(foldInner.rightPaneMode).toBe("docked");
    expect(foldInner.feedbackGutterMode).toBe("sheet");
    expect(foldInner.allowDualDockedSidebars).toBe(false);
  });

  it("TC-15 & TC-16: resolves expanded and ultra-wide desktop 3-pane inline layouts (>=1180px)", () => {
    const expanded = resolveStudioLayout(1280);
    expect(expanded.tier).toBe("expanded");
    expect(expanded.leftPaneMode).toBe("docked");
    expect(expanded.rightPaneMode).toBe("docked");
    expect(expanded.feedbackGutterMode).toBe("sheet");
    expect(expanded.allowDualDockedSidebars).toBe(true);

    const ultraWide = resolveStudioLayout(1600);
    expect(ultraWide.tier).toBe("expanded");
    expect(ultraWide.leftPaneMode).toBe("docked");
    expect(ultraWide.rightPaneMode).toBe("docked");
    expect(ultraWide.feedbackGutterMode).toBe("docked");
    expect(ultraWide.allowDualDockedSidebars).toBe(true);
  });
});
