"use client";

import { useCallback, useEffect, useRef } from "react";
import { computeCharsToTake, MIN_INTERVAL_MS } from "@/lib/features/chat/typewriter";

/**
 * Hook to manage smooth typewriter token buffering with requestAnimationFrame
 * Decouples network arrival of SSE tokens from UI frame rate.
 */
export function useTypewriterBuffer(
  onChunk: (chunk: string) => void,
  minIntervalMs = MIN_INTERVAL_MS
) {
  const bufferRef = useRef("");
  const accumulatedRef = useRef("");
  const rafIdRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const isActiveRef = useRef(false);

  const startTypewriter = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      if (!isActiveRef.current) return;

      const elapsed = now - lastTickRef.current;
      if (elapsed >= minIntervalMs) {
        if (bufferRef.current.length > 0) {
          const chars = computeCharsToTake(bufferRef.current.length);
          const chunk = bufferRef.current.slice(0, chars);
          bufferRef.current = bufferRef.current.slice(chars);
          onChunk(chunk);
        }
        lastTickRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [minIntervalMs, onChunk]);

  const stopTypewriter = useCallback(
    (flush = true) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isActiveRef.current = false;

      if (flush && bufferRef.current.length > 0) {
        const remaining = bufferRef.current;
        bufferRef.current = "";
        onChunk(remaining);
      }
    },
    [onChunk]
  );

  const appendToTypewriterBuffer = useCallback((token: string) => {
    bufferRef.current += token;
    accumulatedRef.current += token;
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    accumulatedRef.current = "";
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    isActiveRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    bufferRef,
    accumulatedRef,
    startTypewriter,
    stopTypewriter,
    appendToTypewriterBuffer,
    resetBuffer,
  };
}
