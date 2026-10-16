// /app/features/novelcrafter/hooks/useStudioLayout.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  resolveStudioLayout,
  type StudioLayoutConfig,
} from "@/lib/features/novelcrafter/studioLayout";

export interface UseStudioLayoutResult {
  viewportWidth: number;
  config: StudioLayoutConfig;
  navigatorMode: "inline" | "drawer";
  historyMode: "inline" | "drawer";
  feedbackMode: "inline" | "bottom-sheet";
  isVirtualKeyboardOpen: boolean;
  keyboardOffsetPx: number;
}

const DEFAULT_SSR_WIDTH = 1280;

export function useStudioLayout(): UseStudioLayoutResult {
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : DEFAULT_SSR_WIDTH
  );
  const [keyboardOffsetPx, setKeyboardOffsetPx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const nextWidth = window.innerWidth;
      setViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;

    const updateViewportMetrics = () => {
      const layoutHeight = window.innerHeight;
      const visualHeight = vv.height;
      const diff = Math.max(0, Math.round(layoutHeight - visualHeight - vv.offsetTop));
      const nextOffset = diff > 110 ? diff : 0;
      setKeyboardOffsetPx((prev) => (prev === nextOffset ? prev : nextOffset));
    };

    updateViewportMetrics();
    vv.addEventListener("resize", updateViewportMetrics);
    vv.addEventListener("scroll", updateViewportMetrics);
    return () => {
      vv.removeEventListener("resize", updateViewportMetrics);
      vv.removeEventListener("scroll", updateViewportMetrics);
    };
  }, []);

  const config = useMemo(() => resolveStudioLayout(viewportWidth), [viewportWidth]);

  return {
    viewportWidth,
    config,
    navigatorMode: config.leftPaneMode === "docked" ? "inline" : "drawer",
    historyMode: config.rightPaneMode === "docked" ? "inline" : "drawer",
    feedbackMode: config.feedbackGutterMode === "docked" ? "inline" : "bottom-sheet",
    isVirtualKeyboardOpen: keyboardOffsetPx > 0,
    keyboardOffsetPx,
  };
}
