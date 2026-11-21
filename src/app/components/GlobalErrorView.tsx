"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { translations } from "@/lib/utils/translations";
import {
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
  type ResolvedLanguage,
} from "@/lib/utils/translations/resolveInitialLanguage";

interface GlobalErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Self-contained fallback view for Next.js `global-error.tsx`.
 * Uses inline styles with Vikini 3.0 CSS-variable fallbacks (Hoàng Hôn dark) and zero
 * dependency on RootLayout, globals.css, Providers, or Zustand stores.
 */
export default function GlobalErrorView({ error, reset }: GlobalErrorViewProps) {
  const [lang, setLang] = useState<ResolvedLanguage>("en");

  useEffect(() => {
    console.error("Next.js Global Error Boundary caught an error:", error);
  }, [error]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    const resolved = resolveInitialLanguage(stored, window.navigator?.language);
    setLang(resolved);
    if (typeof document !== "undefined") {
      document.documentElement.lang = resolved;
      document.title = translations[resolved].globalErrorTitle;
    }
  }, []);

  const dict = translations[lang];

  return (
    <main
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        backgroundColor: "var(--bg, #0c0a09)",
        color: "var(--text, #f5ebe4)",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          marginBottom: "1.5rem",
          borderRadius: "50%",
          backgroundColor: "rgba(248, 113, 113, 0.12)",
          border: "1px solid rgba(248, 113, 113, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertCircle aria-hidden="true" width={32} height={32} color="#f87171" />
      </div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
        {dict.globalErrorTitle}
      </h1>

      <p
        style={{
          color: "var(--muted, #b8a99e)",
          margin: "0 0 1rem 0",
          maxWidth: "420px",
          lineHeight: 1.5,
        }}
      >
        {dict.globalErrorDescription}
      </p>

      {error?.digest && (
        <p
          style={{
            color: "var(--faint, #8a7c72)",
            fontSize: "0.75rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            margin: "0 0 1.5rem 0",
          }}
        >
          {dict.errorReferenceId}: {error.digest}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.625rem 1.125rem",
            minHeight: "40px",
            backgroundColor: "var(--raised, #201a17)",
            color: "var(--text, #f5ebe4)",
            border: "1px solid var(--line, rgba(255, 232, 214, 0.12))",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {dict.tryAgain}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "0.625rem 1.125rem",
            minHeight: "40px",
            backgroundColor: "var(--accent, #ff8a4c)",
            color: "var(--on-accent, #140905)",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {dict.reloadPage}
        </button>
      </div>
    </main>
  );
}
