"use client";
import { useCallback, useMemo } from "react";
import { translations } from "@/lib/utils/config";

import { useLanguageStore } from "@/lib/store/languageStore";

export const LANGS = ["vi", "en"] as const;

export type Language = (typeof LANGS)[number];
export type SupportedLanguage = Language;

export function useLanguage() {
  const { language, setLanguage } = useLanguageStore();

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
