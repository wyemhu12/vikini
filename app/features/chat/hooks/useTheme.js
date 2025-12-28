"use client";
import { useEffect, useMemo, useState, useCallback } from "react";

const THEME_IDS = ["blueprint", "amber", "indigo", "charcoal", "gold", "red", "rose"];

export function useTheme() {
  const [theme, setTheme] = useState("blueprint");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-theme");
    if (stored && THEME_IDS.includes(stored)) setTheme(stored);
  }, []);

  useEffect(() => {
    // remove all known theme classes
    const root = document.documentElement;
    for (const id of THEME_IDS) root.classList.remove(`theme-${id}`);

    // add active theme class
    root.classList.add(`theme-${theme}`);
    localStorage.setItem("vikini-theme", theme);
  }, [theme]);

  /**
   * Backward-compatible helper:
   * - toggleTheme("red") => set theme to "red"
   * - toggleTheme() => cycle theme list
   */
  const toggleTheme = useCallback((next) => {
    if (typeof next === "string" && THEME_IDS.includes(next)) {
      setTheme(next);
      return;
    }
    setTheme((prev) => {
      const idx = THEME_IDS.indexOf(prev);
      const nextIdx = idx === -1 ? 0 : (idx + 1) % THEME_IDS.length;
      return THEME_IDS[nextIdx];
    });
  }, []);

  return { theme, setTheme, toggleTheme, themeIds: THEME_IDS };
}
