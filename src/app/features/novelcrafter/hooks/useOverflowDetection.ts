"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_CHAR_LENGTH_FOR_FALLBACK_EXPAND = 260;

export interface UseOverflowDetectionOptions {
  content: string;
  isExpanded: boolean;
}

export function useOverflowDetection<T extends HTMLElement = HTMLDivElement>({
  content,
  isExpanded,
}: UseOverflowDetectionOptions) {
  const contentRef = useRef<T | null>(null);
  const [measuredOverflow, setMeasuredOverflow] = useState(false);

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!isExpanded) {
      const overflows = el.scrollHeight > el.clientHeight + 2;
      setMeasuredOverflow(overflows);
    }
  }, [isExpanded]);

  useEffect(() => {
    measure();
  }, [content, isExpanded, measure]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const isLongTextFallback =
    content.length > MIN_CHAR_LENGTH_FOR_FALLBACK_EXPAND || content.split("\n").length > 5;

  return {
    contentRef,
    isOverflowing: measuredOverflow || isLongTextFallback,
  };
}
