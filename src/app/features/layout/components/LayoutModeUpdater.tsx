"use client";

import { useEffect } from "react";
import { useLayoutStore } from "@/lib/store/layoutStore";

/**
 * Syncs the layout mode from Zustand store to the <html> element.
 * Adds/removes `layout-linear` class for CSS structural overrides.
 */
export default function LayoutModeUpdater() {
  const { layoutMode } = useLayoutStore();

  useEffect(() => {
    const root = document.documentElement;
    if (layoutMode === "linear") {
      root.classList.add("layout-linear");
    } else {
      root.classList.remove("layout-linear");
    }
    return () => {
      root.classList.remove("layout-linear");
    };
  }, [layoutMode]);

  return null;
}
