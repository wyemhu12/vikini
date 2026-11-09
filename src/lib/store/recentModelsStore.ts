// Recently used chat models (most recent first), persisted per browser.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/utils/safeStorage";

export const MAX_RECENT_MODELS = 3;

interface RecentModelsState {
  recentModelIds: string[];
  pushRecentModel: (id: string) => void;
}

/** Keeps only string ids from persisted (untrusted) storage, capped and de-duplicated. */
export function sanitizeRecentModelIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)].slice(0, MAX_RECENT_MODELS);
}

export const useRecentModelsStore = create<RecentModelsState>()(
  persist(
    (set) => ({
      recentModelIds: [],
      pushRecentModel: (id) =>
        set((s) => ({
          recentModelIds: [id, ...s.recentModelIds.filter((x) => x !== id)].slice(
            0,
            MAX_RECENT_MODELS
          ),
        })),
    }),
    {
      name: "vikini-recent-models",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      // Loaded when the picker opens (after hydration) so SSR markup never differs.
      skipHydration: true,
      partialize: (s) => ({ recentModelIds: s.recentModelIds }),
      merge: (persisted, current) => ({
        ...current,
        recentModelIds: sanitizeRecentModelIds(
          typeof persisted === "object" && persisted !== null
            ? (persisted as { recentModelIds?: unknown }).recentModelIds
            : undefined
        ),
      }),
    }
  )
);
