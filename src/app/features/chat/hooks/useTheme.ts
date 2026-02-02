"use client";
import { useTheme as useNextTheme } from "next-themes";
import { THEME_CONFIG, ThemeTone } from "@/lib/config/theme-config";

export type { ThemeTone };
export type ThemeId = string;

export const THEME_IDS = THEME_CONFIG.map((t) => t.id);

export const THEME_TONES: Record<string, ThemeTone> = THEME_CONFIG.reduce(
  (acc, { id, tone }) => {
    acc[id] = tone;
    return acc;
  },
  {} as Record<string, ThemeTone>
);

export function useTheme() {
  const { theme, setTheme, forcedTheme, resolvedTheme, systemTheme } = useNextTheme();

  const toggleTheme = (next?: string) => {
    if (next) {
      setTheme(next);
      return;
    }
    // Cycle through themes
    const idx = THEME_IDS.indexOf(theme || "blueprint");
    const nextIdx = idx === -1 ? 0 : (idx + 1) % THEME_IDS.length;
    setTheme(THEME_IDS[nextIdx]);
  };

  return {
    theme,
    setTheme,
    toggleTheme,
    themeIds: THEME_IDS,
    forcedTheme,
    resolvedTheme,
    systemTheme,
  };
}
