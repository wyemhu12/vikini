// /lib/features/novelcrafter/promptStudioStore.ts
// Persisted Zustand store for Novelcrafter Prompt Studio (skipHydration + safeLocalStorage)

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "@/lib/utils/logger";
import type { NovelcrafterPromptActionKey } from "./promptActions";
import {
  applyPreset,
  createCustomPreset,
  createDefaultPromptStudioSettings,
  deleteCustomPreset,
  resetActionOverride,
  resetAllPromptOverrides,
  sanitizePromptStudioSettings,
  setActionOverride,
  type CreateCustomPresetResult,
  type PromptActionOverride,
  type PromptStudioSettings,
} from "./promptStudioSettings";

const storeLogger = logger.withContext("promptStudioStore");

export const PROMPT_STUDIO_STORAGE_KEY = "vikini:novelcrafter:prompt-studio" as const;

export interface PromptStudioStoreState {
  settings: PromptStudioSettings;
  persistErrorAt: number | null;
  setActionOverride: (key: NovelcrafterPromptActionKey, next: PromptActionOverride) => void;
  resetActionOverride: (key: NovelcrafterPromptActionKey) => void;
  resetAllOverrides: () => void;
  applyPreset: (presetId: string) => void;
  createCustomPreset: (name: string) => CreateCustomPresetResult;
  deleteCustomPreset: (presetId: string) => void;
  clearPersistError: () => void;
}

let isRecordingPersistError = false;

const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(name);
      if (!raw) return null;
      // Validate JSON structure up-front so corrupted payloads never throw inside Zustand
      JSON.parse(raw);
      return raw;
    } catch (err: unknown) {
      storeLogger.warn(
        "Corrupted or unreadable Prompt Studio storage, falling back to default:",
        err
      );
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined" || isRecordingPersistError) return;
    try {
      window.localStorage.setItem(name, value);
    } catch (err: unknown) {
      storeLogger.warn("Failed to persist Prompt Studio settings to localStorage:", err);
      isRecordingPersistError = true;
      try {
        usePromptStudioStore.setState({ persistErrorAt: Date.now() });
      } finally {
        isRecordingPersistError = false;
      }
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch (err: unknown) {
      storeLogger.warn("Failed to remove Prompt Studio storage key:", err);
    }
  },
};

export const usePromptStudioStore = create<PromptStudioStoreState>()(
  persist(
    (set, get) => ({
      settings: createDefaultPromptStudioSettings(),
      persistErrorAt: null,
      setActionOverride: (key, next) => {
        set((state) => ({
          persistErrorAt: null,
          settings: setActionOverride(state.settings, key, next),
        }));
      },
      resetActionOverride: (key) => {
        set((state) => ({
          persistErrorAt: null,
          settings: resetActionOverride(state.settings, key),
        }));
      },
      resetAllOverrides: () => {
        set((state) => ({
          persistErrorAt: null,
          settings: resetAllPromptOverrides(state.settings),
        }));
      },
      applyPreset: (presetId) => {
        set((state) => ({
          persistErrorAt: null,
          settings: applyPreset(state.settings, presetId),
        }));
      },
      createCustomPreset: (name) => {
        set({ persistErrorAt: null });
        const result = createCustomPreset(get().settings, name);
        if (result.ok) {
          set({ settings: result.settings });
        }
        return result;
      },
      deleteCustomPreset: (presetId) => {
        set((state) => ({
          persistErrorAt: null,
          settings: deleteCustomPreset(state.settings, presetId),
        }));
      },
      clearPersistError: () => set({ persistErrorAt: null }),
    }),
    {
      name: PROMPT_STUDIO_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true,
      partialize: (state) => ({ settings: state.settings }),
      migrate: (persisted) => ({
        settings: sanitizePromptStudioSettings((persisted as { settings?: unknown })?.settings),
      }),
      merge: (persisted, currentState) => ({
        ...currentState,
        settings: sanitizePromptStudioSettings((persisted as { settings?: unknown })?.settings),
      }),
    }
  )
);

/**
 * Re-reads localStorage into the Zustand store so edits made in another tab
 * (/novelcrafter/prompts) are always picked up before starting a stream.
 */
export async function ensurePromptStudioHydrated(): Promise<void> {
  try {
    await usePromptStudioStore.persist.rehydrate();
  } catch (err: unknown) {
    storeLogger.warn("Failed to rehydrate Prompt Studio store:", err);
  }
}
