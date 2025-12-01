"use client";
import { useEffect, useState } from "react";

export function useSystemMode() {
  const [mode, setMode] = useState("default");

  useEffect(() => {
    const stored = localStorage.getItem("vikini-system-mode");
    if (stored) setMode(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("vikini-system-mode", mode);
  }, [mode]);

  return { systemMode: mode, setSystemMode: setMode };
}
