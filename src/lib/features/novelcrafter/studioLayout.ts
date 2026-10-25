// /lib/features/novelcrafter/studioLayout.ts
// Pure responsive layout calculator for Novelcrafter Studio across Compact, Medium, and Expanded viewports

export type StudioViewportTier = "compact" | "medium" | "expanded";
export type StudioPaneMode = "docked" | "sheet" | "bottom-sheet";
export type DockedPaneId = "navigator" | "history" | "feedback";

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
  maxDockedSidePanes: 0 | 1 | 2 | 3;
}

export function applyDockedPaneToggle(
  openOrder: readonly DockedPaneId[],
  pane: DockedPaneId,
  maxDocked: number
): DockedPaneId[] {
  if (!Number.isFinite(maxDocked) || maxDocked <= 0) {
    return [];
  }
  if (openOrder.includes(pane)) {
    return openOrder.filter((id) => id !== pane);
  }
  const next = [...openOrder, pane];
  if (next.length > maxDocked) {
    return next.slice(next.length - maxDocked);
  }
  return next;
}

export function resolveInitialDockedPanes(maxDocked: number): DockedPaneId[] {
  if (!Number.isFinite(maxDocked) || maxDocked <= 0) {
    return [];
  }
  const defaults: readonly DockedPaneId[] = ["navigator", "history"];
  return defaults.slice(0, Math.min(defaults.length, Math.floor(maxDocked)));
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
      maxDockedSidePanes: 0,
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
      maxDockedSidePanes: 0,
    };
  }

  const maxDockedSidePanes: 1 | 2 | 3 = width >= 1920 ? 3 : width >= 1536 ? 2 : 1;
  return {
    tier: "expanded",
    leftPaneMode: "docked",
    rightPaneMode: "docked",
    feedbackGutterMode: "docked",
    leftWidthPx: width >= 1440 ? 256 : 224,
    rightWidthPx: width >= 1440 ? 360 : 320,
    gutterWidthPx: 320,
    minEditorWidthPx: 640,
    allowDualDockedSidebars: maxDockedSidePanes >= 2,
    maxDockedSidePanes,
  };
}
