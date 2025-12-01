"use client";
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState("amber");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-theme");
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove(
      "theme-amber",
      "theme-indigo",
      "theme-charcoal"
    );
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem("vikini-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
