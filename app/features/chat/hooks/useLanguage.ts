"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { translations } from "@/lib/utils/config";

const LANGS = ["vi", "en"] as const;

export type Language = (typeof LANGS)[number];

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("vi");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-language");
    if (stored && LANGS.includes(stored as Language)) setLanguage(stored as Language);
  }, []);

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
        dict?.[key] ?? (translations?.en as Record<string, string>)?.[key] ?? (translations?.vi as Record<string, string>)?.[key] ?? String(key)
      );
    },
    [dict]
  );

  return { language, setLanguage, t, langs: LANGS };
}

