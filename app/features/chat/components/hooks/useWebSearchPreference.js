// /app/components/Chat/hooks/useWebSearchPreference.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Client-side preference store for Web Search toggle.
 * - Persists to localStorage key: vikini.webSearch ("1" | "0")
 * - Mirrors to cookie: vikini_web_search ("1" | "0")
 * - Tracks server-reported capability & effective enablement via SSE meta.
 */
export function useWebSearchPreference() {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [serverWebSearch, setServerWebSearch] = useState(null); // null | boolean
  const [serverWebSearchAvailable, setServerWebSearchAvailable] = useState(null); // null | boolean

  const getCookie = useCallback((name) => {
    if (typeof document === "undefined") return null;
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    for (const c of cookies) {
      const [k, ...rest] = c.split("=");
      if (k === name) return decodeURIComponent(rest.join("="));
    }
    return null;
  }, []);

  const setCookie = useCallback((name, value) => {
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
    } catch {}

    document.cookie = parts.join("; ");
  }, []);

  // Initialize preference from localStorage (preferred) then cookie.
  useEffect(() => {
    try {
      const ls = localStorage.getItem("vikini.webSearch");
      if (ls === "1" || ls === "0") {
        const enabled = ls === "1";
        setWebSearchEnabled(enabled);
        setCookie("vikini_web_search", enabled ? "1" : "0");
        return;
      }

      const c = getCookie("vikini_web_search");
      if (c === "1" || c === "0") {
        setWebSearchEnabled(c === "1");
      }
    } catch {}
  }, [getCookie, setCookie]);

  const toggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vikini.webSearch", next ? "1" : "0");
      } catch {}

      setCookie("vikini_web_search", next ? "1" : "0");
      return next;
    });
  }, [setCookie]);

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

    serverWebSearch,
    setServerWebSearch,
    serverWebSearchAvailable,
    setServerWebSearchAvailable,
    serverHint,
  };
}
