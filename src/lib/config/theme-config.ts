import { TranslationKey } from "@/lib/utils/config";

export type ThemeTone = "light" | "dark";
export type ThemeGroup = "Glassmorphism" | "Focus" | "Red Alert 2";

export interface ThemeDefinition {
  id: string;
  labelKey: TranslationKey;
  group: ThemeGroup;
  swatch: string;
  tone: ThemeTone;
}

export const THEME_CONFIG: ThemeDefinition[] = [
  // --- GLASSMORPHISM ---
  { id: "nebula", labelKey: "nebula", swatch: "#22d3ee", group: "Glassmorphism", tone: "dark" },
  { id: "orchid", labelKey: "orchid", swatch: "#c084fc", group: "Glassmorphism", tone: "dark" },
  { id: "aqua", labelKey: "aqua", swatch: "#14b8a6", group: "Glassmorphism", tone: "dark" },
  { id: "holo", labelKey: "holo", swatch: "#22d3ee", group: "Glassmorphism", tone: "dark" },
  { id: "sunset", labelKey: "sunset", swatch: "#f97316", group: "Glassmorphism", tone: "dark" },

  // --- FOCUS ---
  { id: "blueprint", labelKey: "blueprint", swatch: "#3b82f6", group: "Focus", tone: "dark" },
  { id: "amber", labelKey: "amber", swatch: "#d97706", group: "Focus", tone: "dark" },
  { id: "indigo", labelKey: "indigo", swatch: "#6366f1", group: "Focus", tone: "dark" },
  { id: "charcoal", labelKey: "charcoal", swatch: "#4b5563", group: "Focus", tone: "dark" },
  { id: "gold", labelKey: "gold", swatch: "#d4af37", group: "Focus", tone: "dark" },
  { id: "red", labelKey: "red", swatch: "#ef4444", group: "Focus", tone: "dark" },
  { id: "rose", labelKey: "rose", swatch: "#cc8899", group: "Focus", tone: "dark" },

  // --- RED ALERT 2 ---
  { id: "yuri", labelKey: "yuri", swatch: "#a855f7", group: "Red Alert 2", tone: "dark" },
  { id: "allied", labelKey: "allied", swatch: "#38bdf8", group: "Red Alert 2", tone: "dark" },
  { id: "soviet", labelKey: "soviet", swatch: "#ef4444", group: "Red Alert 2", tone: "dark" },
];

export const THEME_IDS = THEME_CONFIG.map((t) => t.id);
export const DEFAULT_THEME = "blueprint";

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEME_CONFIG.find((t) => t.id === id);
}
