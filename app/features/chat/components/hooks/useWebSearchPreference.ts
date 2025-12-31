// /app/features/chat/components/hooks/useWebSearchPreference.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Client-side preference store for Web Search toggle.
 * - Persists to localStorage key: vikini.webSearch ("1" | "0")
 * - Mirrors to cookie: webSearchEnabled ("1" | "0") (Synced with backend expectation)
 * - Tracks server-reported capability & effective enablement via SSE meta.
 * - alwaysSearch: forces web search for every request (Gemini only)
 */
export function useWebSearchPreference() {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [alwaysSearch, setAlwaysSearch] = useState(false);
  const [serverWebSearch, setServerWebSearch] = useState<boolean | null>(null); // null | boolean
  const [serverWebSearchAvailable, setServerWebSearchAvailable] = useState<boolean | null>(null); // null | boolean

  const getCookie = useCallback((name: string): string | null => {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const c of cookies) {
      const [k, ...rest] = c.split("=");
      if (k === name) return decodeURIComponent(rest.join("="));
    }
    return null;
  }, []);

  const setCookie = useCallback((name: string, value: string): void => {
    if (typeof document === "undefined") return;

    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      "path=/",
      "max-age=31536000",
      "samesite=lax",
    ];

    try {
      if (typeof window !== "undefined" && window.location?.protocol === "https:") {
        parts.push("secure");
      }
    } catch {
      // Ignore errors
    }

    document.cookie = parts.join("; ");
  }, []);

  // Initialize preference from localStorage (preferred) then cookie.
  useEffect(() => {
    try {
      const ls = localStorage.getItem("vikini.webSearch");
      if (ls === "1" || ls === "0") {
        const enabled = ls === "1";
        setWebSearchEnabled(enabled);
        setCookie("webSearchEnabled", enabled ? "1" : "0");
      } else {
        const c = getCookie("webSearchEnabled");
        if (c === "1" || c === "0") {
          setWebSearchEnabled(c === "1");
        }
      }

      // Load alwaysSearch preference
      const alwaysSearchLs = localStorage.getItem("vikini.alwaysSearch");
      if (alwaysSearchLs === "1" || alwaysSearchLs === "0") {
        const enabled = alwaysSearchLs === "1";
        setAlwaysSearch(enabled);
        setCookie("alwaysSearch", enabled ? "1" : "0");
      }
    } catch {
      // Ignore errors
    }
  }, [getCookie, setCookie]);

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vikini.webSearch", next ? "1" : "0");
      } catch {
        // Ignore errors
      }

      setCookie("webSearchEnabled", next ? "1" : "0");
      return next;
    });
  }, [setCookie]);

  const toggleAlwaysSearch = useCallback(() => {
    setAlwaysSearch((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vikini.alwaysSearch", next ? "1" : "0");
      } catch {
        // Ignore errors
      }

      setCookie("alwaysSearch", next ? "1" : "0");

      // If turning on alwaysSearch, also turn on webSearch
      if (next && !webSearchEnabled) {
        setWebSearchEnabled(true);
        try {
          localStorage.setItem("vikini.webSearch", "1");
        } catch {
          // Ignore errors
        }
        setCookie("webSearchEnabled", "1");
      }

      return next;
    });
  }, [setCookie, webSearchEnabled]);

  const serverHint = useMemo(() => {
    return serverWebSearchAvailable === false
      ? " (server: feature OFF)"
      : serverWebSearch === false && webSearchEnabled
        ? " (server: OFF)"
        : "";
  }, [serverWebSearchAvailable, serverWebSearch, webSearchEnabled]);

  return {
    webSearchEnabled,
    toggleWebSearch,
    alwaysSearch,
    toggleAlwaysSearch,

    serverWebSearch,
    setServerWebSearch,
    serverWebSearchAvailable,
    setServerWebSearchAvailable,
    serverHint,
  };
}
