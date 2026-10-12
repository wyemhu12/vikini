// /app/features/chat/components/ChatThemeBackground.tsx
"use client";

import React from "react";

const RA2_THEMES = ["yuri", "allied", "soviet"] as const;
type Ra2Theme = (typeof RA2_THEMES)[number];

const THEME_FILTERS: Record<Ra2Theme, string> = {
  yuri: "drop-shadow(0 0 60px rgba(168, 85, 247, 0.5))",
  allied: "drop-shadow(0 0 80px rgba(56, 189, 248, 0.4))",
  soviet:
    "drop-shadow(0 0 60px rgba(239, 68, 68, 0.6)) drop-shadow(0 0 100px rgba(251, 191, 36, 0.3))",
};

function isRa2Theme(theme: string): theme is Ra2Theme {
  return (RA2_THEMES as readonly string[]).includes(theme);
}

interface ChatThemeBackgroundProps {
  theme: string;
  sidebarCollapsed: boolean;
}

/** RA2 theme emblem rendered behind the chat log (sidebar-aware). Renders nothing for other themes. */
export default function ChatThemeBackground({ theme, sidebarCollapsed }: ChatThemeBackgroundProps) {
  if (!isRa2Theme(theme)) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 z-0 pointer-events-none transition-[left] duration-300 ${sidebarCollapsed ? "md:left-[calc(5rem+var(--sal,0px))]" : "md:left-[calc(18rem+var(--sal,0px))] lg:left-[calc(20rem+var(--sal,0px))]"}`}
      style={{
        backgroundImage: `url('/assets/themes/${theme}.png')`,
        backgroundSize: theme === "allied" ? "38%" : "35%",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        opacity: theme === "soviet" ? 0.2 : theme === "yuri" ? 0.18 : 0.15,
        filter: THEME_FILTERS[theme],
      }}
    />
  );
}
