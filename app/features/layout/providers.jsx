"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { THEME_CONFIG } from "@/lib/config/theme-config";

export default function Providers({ children }) {
  // Map clean IDs (e.g., "blueprint") to CSS classes (e.g., "theme-blueprint")
  const themeMap = THEME_CONFIG.reduce((acc, theme) => {
    acc[theme.id] = `theme-${theme.id}`;
    return acc;
  }, {});

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="blueprint"
        enableSystem={false}
        disableTransitionOnChange
        value={themeMap}
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
