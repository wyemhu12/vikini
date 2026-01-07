"use client";

import { useEffect } from "react";
import { useLanguageStore } from "@/lib/store/languageStore";

export default function LanguageUpdater() {
  const { language } = useLanguageStore();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
