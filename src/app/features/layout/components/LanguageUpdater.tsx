"use client";

import { useEffect, useState } from "react";
import { useLanguageStore } from "@/lib/store/languageStore";
import {
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
} from "@/lib/utils/translations/resolveInitialLanguage";

export { LANGUAGE_STORAGE_KEY, resolveInitialLanguage };

export default function LanguageUpdater() {
  const { language, setLanguage } = useLanguageStore();
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. Read first on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
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
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language;
    }
  }, [language, hasHydrated]);

  return null;
}
