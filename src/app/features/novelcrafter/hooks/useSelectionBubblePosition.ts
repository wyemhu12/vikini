// /app/features/novelcrafter/hooks/useSelectionBubblePosition.ts
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  computeSelectionBubblePosition,
  isRectVisibleWithin,
  type SelectionBubblePlacement,
} from "@/lib/features/novelcrafter/selectionBubblePlacement";

interface UseSelectionBubblePositionOptions {
  /** False in docked-bottom mode or when there is no selection: no position, no listeners. */
  enabled: boolean;
  getSelectionRect: () => DOMRect | null;
  /** Visible area the selection must stay within (the manuscript scroll box, or the viewport). */
  getBoundaryRect: () => DOMRect | null;
  bubbleWidth: number;
  bubbleHeight: number;
  /** Changes whenever the selection or bubble content changes, to force a recompute. */
  updateKey: string;
}

function samePosition(a: SelectionBubblePlacement | null, b: SelectionBubblePlacement | null) {
  return (
    a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.placement === b.placement)
  );
}

/**
 * Viewport (position: fixed) coordinates for the floating selection bubble.
 * Recomputed on any scroll (capture) and resize; null when the selection is outside the boundary.
 */
export function useSelectionBubblePosition({
  enabled,
  getSelectionRect,
  getBoundaryRect,
  bubbleWidth,
  bubbleHeight,
  updateKey,
}: UseSelectionBubblePositionOptions): SelectionBubblePlacement | null {
  const [position, setPosition] = useState<SelectionBubblePlacement | null>(null);
  // Latest getters without re-subscribing listeners on every render.
  const gettersRef = useRef({ getSelectionRect, getBoundaryRect });
  gettersRef.current = { getSelectionRect, getBoundaryRect };

  useLayoutEffect(() => {
    if (!enabled) {
      setPosition(null);
      return;
    }
    const update = () => {
      const sel = gettersRef.current.getSelectionRect();
      let next: SelectionBubblePlacement | null = null;
      if (sel && (sel.width > 0 || sel.height > 0)) {
        const boundary = gettersRef.current.getBoundaryRect();
        if (!boundary || isRectVisibleWithin(sel, boundary)) {
          next = computeSelectionBubblePosition({
            selectionRect: { top: sel.top, left: sel.left, width: sel.width, height: sel.height },
            containerRect: {
              top: 0,
              left: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            },
            containerScrollTop: 0,
            bubbleWidth,
            bubbleHeight,
          });
        }
      }
      setPosition((prev) => (samePosition(prev, next) ? prev : next));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [enabled, bubbleWidth, bubbleHeight, updateKey]);

  return enabled ? position : null;
}
