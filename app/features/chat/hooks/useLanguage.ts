"use client";
import { useCallback, useEffect, useMemo } from "react";
import { translations } from "@/lib/utils/config";

import { useLanguageStore } from "@/lib/store/languageStore";

export const LANGS = ["vi", "en"] as const;

export type Language = (typeof LANGS)[number];

export function useLanguage() {
  const { language, setLanguage } = useLanguageStore();

  // Removed automatic init from localStorage here to avoid infinite loops in children
  // Initialization should be done once in the root component (ChatApp)

  useEffect(() => {
    localStorage.setItem("vikini-language", language);
    // Sync with a custom event for other components to listen if needed
    window.dispatchEvent(new CustomEvent("vikini-language-change", { detail: language }));
  }, [language]);

  const dict = useMemo(() => {
    return (translations?.[language] || translations?.en || {}) as Record<string, string>;
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      if (!key) return "";
      // Ưu tiên ngôn ngữ hiện tại, nếu không có mới tìm trong tiếng Anh, cuối cùng là tiếng Việt
      return (
        dict?.[key] ??
        (translations?.en as Record<string, string>)?.[key] ??
        (translations?.vi as Record<string, string>)?.[key] ??
        String(key)
      );
    },
    [dict]
  );

  return { language, setLanguage, t, langs: LANGS };
}
