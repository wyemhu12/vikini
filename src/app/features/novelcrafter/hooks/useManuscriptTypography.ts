// /app/features/novelcrafter/hooks/useManuscriptTypography.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MANUSCRIPT_TYPOGRAPHY,
  MANUSCRIPT_TYPOGRAPHY_STORAGE_KEY,
  sanitizeManuscriptTypography,
  type ManuscriptTypography,
} from "@/lib/features/novelcrafter/manuscriptTypography";
import { logger } from "@/lib/utils/logger";

export function useManuscriptTypography() {
  const [typography, setTypography] = useState<ManuscriptTypography>(DEFAULT_MANUSCRIPT_TYPOGRAPHY);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MANUSCRIPT_TYPOGRAPHY_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        setTypography(sanitizeManuscriptTypography(parsed));
      }
    } catch (error: unknown) {
      logger.warn("Failed to read manuscript typography from localStorage", error);
    }
  }, []);

  const updateTypography = useCallback((patch: Partial<ManuscriptTypography>) => {
    setTypography((prev) => {
      const next = sanitizeManuscriptTypography({ ...prev, ...patch });
      try {
        window.localStorage.setItem(MANUSCRIPT_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(next));
      } catch (error: unknown) {
        logger.warn("Failed to persist manuscript typography to localStorage", error);
      }
      return next;
    });
  }, []);

  return { typography, updateTypography };
}
