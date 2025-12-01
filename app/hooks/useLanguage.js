"use client";
import { useEffect, useState } from "react";

export function useLanguage() {
  const [language, setLanguage] = useState("vi");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-language");
    if (stored) setLanguage(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("vikini-language", language);
  }, [language]);

  return { language, setLanguage };
}
