"use client";

import { useEffect, useState } from "react";
import { useLanguageStore } from "@/lib/store/languageStore";
import { type SupportedLanguage } from "@/app/features/chat/hooks/useLanguage";

const STORAGE_KEY = "vikini-language";

export function resolveInitialLanguage(
  stored: string | null,
  navigatorLang?: string
): SupportedLanguage {
  if (stored === "vi" || stored === "en") return stored;
  if (stored && stored.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(stored);
      const lang =
        typeof parsed === "object" &&
        parsed !== null &&
        "state" in parsed &&
        typeof (parsed as { state?: { language?: unknown } }).state?.language === "string"
          ? (parsed as { state: { language: string } }).state.language
          : null;
      if (lang === "vi" || lang === "en") return lang;
    } catch {
      // Ignore malformed JSON and fall through to navigator language
    }
  }
  return navigatorLang?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export default function LanguageUpdater() {
  const { language, setLanguage } = useLanguageStore();
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. Read first on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      const resolved = resolveInitialLanguage(stored, window.navigator?.language);
      document.documentElement.lang = resolved;
      if (resolved !== useLanguageStore.getState().language) {
        setLanguage(resolved);
      }
    }
    setHasHydrated(true);
  }, [setLanguage]);

  // 2. Write after hydration only when language changes
  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  }, [language, hasHydrated]);

  return null;
}
