// /app/features/novelcrafter/hooks/useAutoResizeTextarea.ts
"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseAutoResizeTextareaOptions {
  value: string;
  minHeight?: number;
  chapterId?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Auto-resizes textarea to match content height smoothly:
 * 1. Checks if modern browser supports native CSS `field-sizing: content`.
 * 2. Guards against collapsed/hidden containers (`offsetParent === null || clientWidth === 0`) (NC-17).
 * 3. Re-measures via ResizeObserver when a collapsed parent accordion opens.
 * 4. Preserves scrollContainer.scrollTop to avoid scroll jitter.
 */
export function useAutoResizeTextarea<T extends HTMLTextAreaElement = HTMLTextAreaElement>({
  value,
  minHeight = 420,
  chapterId,
  scrollContainerRef,
}: UseAutoResizeTextareaOptions) {
  const textareaRef = useRef<T | null>(null);
  const isNativeSupportedRef = useRef<boolean | null>(null);
  const lastMeasuredWidthRef = useRef<number>(0);

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (isNativeSupportedRef.current === null) {
      isNativeSupportedRef.current =
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("field-sizing", "content");
    }

    if (isNativeSupportedRef.current) {
      return;
    }

    // NC-17: Do not collapse height to minHeight when inside a hidden/collapsed container
    if (el.offsetParent === null || el.clientWidth === 0) {
      return;
    }

    const scrollContainer = scrollContainerRef?.current;
    const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    el.style.height = "auto";
    const newHeight = Math.max(minHeight, el.scrollHeight);
    el.style.height = `${newHeight}px`;

    if (scrollContainer && scrollContainer.scrollTop !== prevScrollTop) {
      scrollContainer.scrollTop = prevScrollTop;
    }
  }, [minHeight, scrollContainerRef]);

  useEffect(() => {
    syncHeight();
  }, [value, chapterId, syncHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry ? Math.round(entry.contentRect.width) : el.clientWidth;
      if (width > 0 && width !== lastMeasuredWidthRef.current) {
        lastMeasuredWidthRef.current = width;
        syncHeight();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncHeight]);

  return textareaRef;
}
