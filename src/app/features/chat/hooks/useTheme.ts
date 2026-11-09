"use client";
import { useTheme as useNextTheme } from "next-themes";
import {
  type ThemeFamilyId,
  type ThemeMode,
  parseThemeKey,
  resolveThemeKey,
  toThemeKey,
} from "@/lib/config/theme-config";

export function useTheme() {
  const { theme, setTheme, forcedTheme, resolvedTheme, systemTheme } = useNextTheme();

  const parsed = parseThemeKey(resolveThemeKey(theme));
  const family: ThemeFamilyId = parsed?.family ?? "hoanghon";
  const mode: ThemeMode = parsed?.mode ?? "dark";

  const setFamily = (next: ThemeFamilyId) => setTheme(toThemeKey(next, mode));
  const setMode = (next: ThemeMode) => setTheme(toThemeKey(family, next));
  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return {
    theme,
    setTheme,
    forcedTheme,
    resolvedTheme,
    systemTheme,
    family,
    mode,
    setFamily,
    setMode,
    toggleMode,
  };
}
