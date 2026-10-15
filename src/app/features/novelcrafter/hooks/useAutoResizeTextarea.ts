// /app/features/novelcrafter/hooks/useAutoResizeTextarea.ts
"use client";

import { useEffect, useRef } from "react";

interface UseAutoResizeTextareaOptions {
  value: string;
  minHeight?: number;
  chapterId?: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Auto-resizes textarea to match content height smoothly:
 * 1. Checks if modern browser supports native CSS `field-sizing: content`.
 * 2. In JS fallback: uses scrollHeight measurement with scrollTop preservation to avoid scroll jitter.
 * 3. Correctly shrinks when text is deleted down to `minHeight`.
 * 4. Resets cleanly when chapterId changes.
 */
export function useAutoResizeTextarea<T extends HTMLTextAreaElement = HTMLTextAreaElement>({
  value,
  minHeight = 420,
  chapterId,
  scrollContainerRef,
}: UseAutoResizeTextareaOptions) {
  const textareaRef = useRef<T | null>(null);
  const isNativeSupportedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (isNativeSupportedRef.current === null) {
      isNativeSupportedRef.current =
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("field-sizing", "content");
    }

    if (isNativeSupportedRef.current) {
      // Native browser field-sizing handles auto-growth and auto-shrink
      return;
    }

    // JS Fallback with scrollTop preservation to prevent scroll jump
    const scrollContainer = scrollContainerRef?.current;
    const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    // Temporarily reset height to measure true content height for shrink/grow
    el.style.height = "auto";
    const newHeight = Math.max(minHeight, el.scrollHeight);
    el.style.height = `${newHeight}px`;

    if (scrollContainer && scrollContainer.scrollTop !== prevScrollTop) {
      scrollContainer.scrollTop = prevScrollTop;
    }
  }, [value, minHeight, chapterId, scrollContainerRef]);

  return textareaRef;
}
