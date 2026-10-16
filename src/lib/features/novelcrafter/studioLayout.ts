// /lib/features/novelcrafter/studioLayout.ts
// Pure responsive layout calculator for Novelcrafter Studio across Compact, Medium (Foldable), and Expanded viewports

export type StudioViewportTier = "compact" | "medium" | "expanded";
export type StudioPaneMode = "docked" | "sheet" | "bottom-sheet";

export interface StudioLayoutConfig {
  tier: StudioViewportTier;
  leftPaneMode: StudioPaneMode;
  rightPaneMode: StudioPaneMode;
  feedbackGutterMode: StudioPaneMode;
  leftWidthPx: number;
  rightWidthPx: number;
  gutterWidthPx: number;
  minEditorWidthPx: number;
  allowDualDockedSidebars: boolean;
}

export function resolveStudioLayout(containerWidthPx: number): StudioLayoutConfig {
  const width = Number.isFinite(containerWidthPx) && containerWidthPx > 0 ? containerWidthPx : 1280;

  if (width < 640) {
    return {
      tier: "compact",
      leftPaneMode: "sheet",
      rightPaneMode: "bottom-sheet",
      feedbackGutterMode: "bottom-sheet",
      leftWidthPx: Math.min(300, Math.max(260, Math.floor(width * 0.84))),
      rightWidthPx: width,
      gutterWidthPx: width,
      minEditorWidthPx: Math.max(300, width - 24),
      allowDualDockedSidebars: false,
    };
  }

  if (width < 1180) {
    const canDockRight = width >= 760;
    return {
      tier: "medium",
      leftPaneMode: "sheet",
      rightPaneMode: canDockRight ? "docked" : "sheet",
      feedbackGutterMode: "sheet",
      leftWidthPx: 260,
      rightWidthPx: canDockRight ? Math.min(320, Math.max(260, width - 480)) : 320,
      gutterWidthPx: 320,
      minEditorWidthPx: 460,
      allowDualDockedSidebars: false,
    };
  }

  const isUltraWide = width >= 1480;
  return {
    tier: "expanded",
    leftPaneMode: "docked",
    rightPaneMode: "docked",
    feedbackGutterMode: isUltraWide ? "docked" : "sheet",
    leftWidthPx: width >= 1440 ? 256 : 224,
    rightWidthPx: width >= 1440 ? 360 : 320,
    gutterWidthPx: 320,
    minEditorWidthPx: 640,
    allowDualDockedSidebars: true,
  };
}
