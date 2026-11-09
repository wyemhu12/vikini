"use client";

import React from "react";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { DEFAULT_THEME_KEY, getThemeClassMap } from "@/lib/config/theme-config";
import { useThemeKeyMigration } from "./hooks/useThemeKeyMigration";

// Current keys and legacy ids → CSS class, so a stored legacy id paints correctly before migration.
const THEME_CLASS_MAP = getThemeClassMap();

function ThemeKeyMigrator() {
  useThemeKeyMigration();
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme={DEFAULT_THEME_KEY}
        enableSystem={false}
        disableTransitionOnChange
        value={THEME_CLASS_MAP}
      >
        <ThemeKeyMigrator />
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </ThemeProvider>
    </SessionProvider>
  );
}
