/**
 * Layout Store - Zustand state management for layout mode
 *
 * Controls the structural layout mode (Classic vs Linear).
 * This is orthogonal to the theme system: themes control colors,
 * layout mode controls structure (spacing, blur, borders, radius).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

type LayoutMode = "classic" | "linear";

interface LayoutStore {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayoutMode: () => void;
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      layoutMode: "classic",
      setLayoutMode: (mode) => set({ layoutMode: mode }),
      toggleLayoutMode: () =>
        set((state) => ({
          layoutMode: state.layoutMode === "classic" ? "linear" : "classic",
        })),
    }),
    {
      name: "vikini-layout-mode",
    }
  )
);
