// /app/features/novelcrafter/hooks/useManuscriptBoxHeight.ts
"use client";

import { useEffect, useState, type RefObject } from "react";
import { computeManuscriptBoxHeight } from "@/lib/features/novelcrafter/manuscriptViewport";

interface UseManuscriptBoxHeightOptions {
  outerRef: RefObject<HTMLElement | null>;
  /** Wrapper around every child of the outer scroll area (its size changes when cards above the box toggle). */
  outerContentRef: RefObject<HTMLElement | null>;
  boxRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  keyboardOffsetPx: number;
}

/** Height (px) that makes the manuscript box end at the bottom of the outer viewport; null when disabled. */
export function useManuscriptBoxHeight({
  outerRef,
  outerContentRef,
  boxRef,
  enabled,
  keyboardOffsetPx,
}: UseManuscriptBoxHeightOptions): number | null {
  const [heightPx, setHeightPx] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHeightPx(null);
      return;
    }
    const outer = outerRef.current;
    const box = boxRef.current;
    if (!outer || !box) return;

    const update = () => {
      const boxOffsetTop =
        box.getBoundingClientRect().top - outer.getBoundingClientRect().top + outer.scrollTop;
      const next = computeManuscriptBoxHeight({
        outerClientHeight: outer.clientHeight,
        boxOffsetTop,
        keyboardOffsetPx,
      });
      setHeightPx((prev) => (prev === next ? prev : next));
    };

    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(outer);
    if (outerContentRef.current) observer?.observe(outerContentRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [enabled, keyboardOffsetPx, outerRef, outerContentRef, boxRef]);

  return heightPx;
}
