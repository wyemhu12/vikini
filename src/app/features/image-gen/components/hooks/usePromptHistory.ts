"use client";

import { useState, useEffect, useCallback } from "react";

const HISTORY_KEY = "vikini-prompt-history";
const MAX_HISTORY = 30;

export function usePromptHistory() {
  const [promptHistory, setPromptHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPromptHistory(parsed.filter((item): item is string => typeof item === "string"));
        }
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const addToPromptHistory = useCallback((p: string) => {
    setPromptHistory((prev) => {
      const deduped = prev.filter((h) => h !== p);
      const next = [p, ...deduped].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / storage errors */
      }
      return next;
    });
  }, []);

  const clearPromptHistory = useCallback(() => {
    setPromptHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  return { promptHistory, addToPromptHistory, clearPromptHistory };
}
