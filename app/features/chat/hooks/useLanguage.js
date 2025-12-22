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
  }, [language]);

  const dict = useMemo(() => {
    return translations?.[language] || translations?.vi || {};
  }, [language]);

  const t = useCallback(
    (key) => {
      if (!key) return "";
      return dict?.[key] ?? translations?.vi?.[key] ?? String(key);
    },
    [dict]
  );

  return { language, setLanguage, t, langs: LANGS };
}
