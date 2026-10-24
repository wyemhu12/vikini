"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeThinkingStats,
  type ThinkingStatsSnapshot,
} from "@/lib/features/chat/thinkingStats";

export interface UseThinkingStatsResult {
  stats: ThinkingStatsSnapshot | null;
  markThinking: (chunk: string) => void;
  markAnswer: () => void;
  reset: () => void;
}

export function useThinkingStats(): UseThinkingStatsResult {
  const startedAtRef = useRef<number | null>(null);
  const endedAtRef = useRef<number | null>(null);
  const textRef = useRef<string>("");
  const [live, setLive] = useState(false);
  const [stats, setStats] = useState<ThinkingStatsSnapshot | null>(null);

  const markThinking = useCallback((chunk: string) => {
    if (!chunk) return;
    const now = Date.now();
    if (startedAtRef.current === null) {
      startedAtRef.current = now;
      endedAtRef.current = null;
    }
    textRef.current += chunk;
    setLive(true);
    setStats(
      computeThinkingStats({
        startedAt: startedAtRef.current,
        now,
        text: textRef.current,
        live: true,
      })
    );
  }, []);

  const markAnswer = useCallback(() => {
    if (startedAtRef.current === null) return;
    const now = Date.now();
    if (endedAtRef.current === null) {
      endedAtRef.current = now;
    }
    setLive(false);
    setStats(
      computeThinkingStats({
        startedAt: startedAtRef.current,
        now: endedAtRef.current,
        text: textRef.current,
        live: false,
      })
    );
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    endedAtRef.current = null;
    textRef.current = "";
    setLive(false);
    setStats(null);
  }, []);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (startedAtRef.current === null) return;
      setStats(
        computeThinkingStats({
          startedAt: startedAtRef.current,
          now: Date.now(),
          text: textRef.current,
          live: true,
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [live]);

  return {
    stats,
    markThinking,
    markAnswer,
    reset,
  };
}
