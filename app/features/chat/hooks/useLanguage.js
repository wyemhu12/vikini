"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { translations } from "@/lib/utils/config";

const LANGS = ["vi", "en"];

export function useLanguage() {
  const [language, setLanguage] = useState("vi");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-language");
    if (stored && LANGS.includes(stored)) setLanguage(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("vikini-language", language);
    // Sync with a custom event for other components to listen if needed
    window.dispatchEvent(new CustomEvent('vikini-language-change', { detail: language }));
  }, [language]);

  const dict = useMemo(() => {
    return translations?.[language] || translations?.en || {};
  }, [language]);

  const t = useCallback(
    (key) => {
      if (!key) return "";
      // Ưu tiên ngôn ngữ hiện tại, nếu không có mới tìm trong tiếng Anh, cuối cùng là tiếng Việt
      return dict?.[key] ?? translations?.en?.[key] ?? translations?.vi?.[key] ?? String(key);
    },
    [dict]
  );

  return { language, setLanguage, t, langs: LANGS };
}
