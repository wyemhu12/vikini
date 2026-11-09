// Defensive localStorage adapter for persisted Zustand stores.
// Mirrors the Prompt Studio adapter: never throws (Safari private mode, quota, corrupted JSON).

import type { StateStorage } from "zustand/middleware";
import { logger } from "@/lib/utils/logger";

const storageLogger = logger.withContext("safeStorage");

export const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(name);
      if (!raw) return null;
      JSON.parse(raw); // reject corrupted payloads before Zustand parses them
      return raw;
    } catch (err: unknown) {
      storageLogger.warn(`Unreadable storage key "${name}", using defaults:`, err);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch (err: unknown) {
      storageLogger.warn(`Could not persist storage key "${name}":`, err);
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch (err: unknown) {
      storageLogger.warn(`Could not remove storage key "${name}":`, err);
    }
  },
};
