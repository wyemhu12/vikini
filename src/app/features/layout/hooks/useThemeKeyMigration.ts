"use client";

import { useEffect } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { isThemeKey, resolveThemeKey } from "@/lib/config/theme-config";

/**
 * Rewrites a stored legacy or invalid theme id (localStorage "theme") to a valid ThemeKey.
 * The first paint is already correct via getThemeClassMap(); this only persists the new key.
 */
export function useThemeKeyMigration(): void {
  const { theme, setTheme } = useNextTheme();

  useEffect(() => {
    if (theme === undefined || isThemeKey(theme)) return;
    setTheme(resolveThemeKey(theme));
  }, [theme, setTheme]);
}
