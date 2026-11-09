// Shared app-shell layout state (context panel collapsed per section), persisted across pages.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/utils/safeStorage";

export type ShellSection = "chat" | "images" | "novelcrafter" | "pages";

export type PanelCollapsedBySection = Record<ShellSection, boolean>;

export const SHELL_SECTIONS: readonly ShellSection[] = ["chat", "images", "novelcrafter", "pages"];

/** Novelcrafter starts in focus mode (panel hidden) until the user opens it. */
export const DEFAULT_PANEL_COLLAPSED: Readonly<PanelCollapsedBySection> = Object.freeze({
  chat: false,
  images: false,
  novelcrafter: true,
  pages: false,
});

interface LayoutState {
  panelCollapsedBySection: PanelCollapsedBySection;
  setPanelCollapsed: (section: ShellSection, value: boolean) => void;
  togglePanel: (section: ShellSection) => void;
}

/** Accepts only boolean values for known sections from persisted (untrusted) storage. */
export function mergeLayoutState(persisted: unknown, current: LayoutState): LayoutState {
  const stored =
    typeof persisted === "object" && persisted !== null
      ? (persisted as { panelCollapsedBySection?: unknown }).panelCollapsedBySection
      : undefined;
  const next: PanelCollapsedBySection = { ...current.panelCollapsedBySection };
  if (typeof stored === "object" && stored !== null) {
    for (const section of SHELL_SECTIONS) {
      const value = (stored as Record<string, unknown>)[section];
      if (typeof value === "boolean") next[section] = value;
    }
  }
  return { ...current, panelCollapsedBySection: next };
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      panelCollapsedBySection: { ...DEFAULT_PANEL_COLLAPSED },
      setPanelCollapsed: (section, value) =>
        set((s) => ({
          panelCollapsedBySection: { ...s.panelCollapsedBySection, [section]: value },
        })),
      togglePanel: (section) =>
        set((s) => ({
          panelCollapsedBySection: {
            ...s.panelCollapsedBySection,
            [section]: !s.panelCollapsedBySection[section],
          },
        })),
    }),
    {
      name: "vikini-layout",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      // SSR and the first client render both use defaults; AppRail rehydrates after mount.
      skipHydration: true,
      partialize: (s) => ({ panelCollapsedBySection: s.panelCollapsedBySection }),
      merge: mergeLayoutState,
    }
  )
);

let rehydrateStarted = false;

/** Loads persisted layout once per page load (called from AppRail after mount). */
export function rehydrateLayoutStore(): void {
  if (rehydrateStarted) return;
  rehydrateStarted = true;
  void useLayoutStore.persist.rehydrate();
}
