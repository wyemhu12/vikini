"use client";

import { useEffect, useState } from "react";
import { useLanguageStore } from "@/lib/store/languageStore";
import { LANGS, type SupportedLanguage } from "@/app/features/chat/hooks/useLanguage";

const STORAGE_KEY = "vikini-language";

export default function LanguageUpdater() {
  const { language, setLanguage } = useLanguageStore();
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. Read first on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (
        stored &&
        (LANGS as readonly string[]).includes(stored) &&
        stored !== useLanguageStore.getState().language
      ) {
        setLanguage(stored as SupportedLanguage);
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
