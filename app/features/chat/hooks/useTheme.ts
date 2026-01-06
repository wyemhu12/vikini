"use client";
import { useEffect, useState, useCallback } from "react";

export type ThemeTone = "light" | "dark";
type ThemeConfigEntry = { id: string; tone: ThemeTone };

const THEME_CONFIG = [
  { id: "blueprint", tone: "dark" },
  { id: "amber", tone: "dark" },
  { id: "indigo", tone: "dark" },
  { id: "charcoal", tone: "dark" },
  { id: "gold", tone: "dark" },
  { id: "red", tone: "dark" },
  { id: "rose", tone: "dark" },
  { id: "yuri", tone: "dark" },
  { id: "allied", tone: "dark" },
  { id: "soviet", tone: "dark" },
  { id: "nebula", tone: "dark" },
  { id: "orchid", tone: "dark" },
  { id: "aqua", tone: "dark" },
  { id: "holo", tone: "dark" },
  { id: "sunset", tone: "dark" },
] as const satisfies readonly ThemeConfigEntry[];

type ThemeConfig = (typeof THEME_CONFIG)[number];
export type ThemeId = ThemeConfig["id"];

const THEME_IDS = THEME_CONFIG.map((theme) => theme.id) as ThemeId[];

export const THEME_TONES: Record<ThemeId, ThemeTone> = THEME_CONFIG.reduce(
  (acc, { id, tone }) => {
    acc[id] = tone;
    return acc;
  },
  {} as Record<ThemeId, ThemeTone>
);

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>("blueprint");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-theme");
    if (stored && THEME_IDS.includes(stored as ThemeId)) setTheme(stored as ThemeId);
  }, []);

  useEffect(() => {
    // remove all known theme classes
    const root = document.documentElement;
    for (const id of THEME_IDS) root.classList.remove(`theme-${id}`);

    // add active theme class
    root.classList.add(`theme-${theme}`);
    root.dataset.themeTone = THEME_TONES[theme] ?? "dark";
    localStorage.setItem("vikini-theme", theme);
  }, [theme]);

  /**
   * Backward-compatible helper:
   * - toggleTheme("red") => set theme to "red"
   * - toggleTheme() => cycle theme list
   */
  const toggleTheme = useCallback((next?: string) => {
    if (typeof next === "string" && THEME_IDS.includes(next as ThemeId)) {
      setTheme(next as ThemeId);
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
