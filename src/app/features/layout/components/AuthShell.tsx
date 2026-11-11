// /app/features/layout/components/AuthShell.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

const LANGUAGES = [
  { id: "vi", label: "Tiếng Việt" },
  { id: "en", label: "English" },
] as const;

/**
 * Shared frame of the signed-out pages (sign-in, auth error): themed background with the
 * horizon glow, a language switch, and the page content in a centered `main`.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-(--bg) px-4 py-20 text-(--text)">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_60%_100%_at_50%_120%,var(--glow),transparent_70%)]"
      />

      <div
        role="group"
        aria-label={t("languageSwitcherLabel")}
        className="absolute right-4 top-4 z-20 flex rounded-full border border-(--line) bg-(--surface) p-1"
      >
        {LANGUAGES.map((lang) => {
          const active = language === lang.id;
          return (
            <button
              key={lang.id}
              type="button"
              lang={lang.id}
              aria-pressed={active}
              onClick={() => setLanguage(lang.id)}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                active ? "bg-(--text) text-(--bg)" : "text-(--muted) hover:text-(--text)"
              )}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      <main className="relative z-10 w-full max-w-md space-y-8 text-center">{children}</main>
    </div>
  );
}
