import { TranslationKey } from "@/lib/utils/config";

export type ThemeMode = "dark" | "light";
export type ThemeFamilyId = "hoanghon" | "muc" | "reu" | "sen" | "than";
export type ThemeKey = `${ThemeFamilyId}-${ThemeMode}`;

export interface ThemeFamily {
  id: ThemeFamilyId;
  labelKey: TranslationKey;
  /** Equals the family's --accent for each mode (used for menu swatches). */
  swatch: Readonly<Record<ThemeMode, string>>;
}

export const THEME_FAMILIES: readonly ThemeFamily[] = [
  { id: "hoanghon", labelKey: "themeHoangHon", swatch: { dark: "#ff8a4c", light: "#c2410c" } },
  { id: "muc", labelKey: "themeMuc", swatch: { dark: "#8ea6ff", light: "#3451d1" } },
  { id: "reu", labelKey: "themeReu", swatch: { dark: "#5cd6a2", light: "#0b7550" } },
  { id: "sen", labelKey: "themeSen", swatch: { dark: "#f48fb8", light: "#b8285f" } },
  { id: "than", labelKey: "themeThan", swatch: { dark: "#f2f2f2", light: "#111111" } },
];

export const THEME_MODES: readonly ThemeMode[] = ["dark", "light"];

export const THEME_KEYS: readonly ThemeKey[] = THEME_FAMILIES.flatMap((family) =>
  THEME_MODES.map((mode): ThemeKey => `${family.id}-${mode}`)
);

export const DEFAULT_THEME_KEY: ThemeKey = "hoanghon-dark";

/** Theme ids from Vikini 2.x (16 themes) mapped to their Vikini 3.0 replacement. */
export const LEGACY_THEME_MAP: Readonly<Record<string, ThemeKey>> = Object.freeze({
  sunset: "hoanghon-dark",
  amber: "hoanghon-dark",
  gold: "hoanghon-dark",
  blueprint: "muc-dark",
  indigo: "muc-dark",
  nebula: "muc-dark",
  holo: "muc-dark",
  allied: "muc-dark",
  aqua: "reu-dark",
  rose: "sen-dark",
  red: "sen-dark",
  soviet: "sen-dark",
  yuri: "sen-dark",
  orchid: "sen-light",
  charcoal: "than-dark",
  "pitch-black": "than-dark",
});

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && (THEME_KEYS as readonly string[]).includes(value);
}

export function isThemeFamilyId(value: unknown): value is ThemeFamilyId {
  return typeof value === "string" && THEME_FAMILIES.some((family) => family.id === value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function toThemeKey(family: ThemeFamilyId, mode: ThemeMode): ThemeKey {
  return `${family}-${mode}`;
}

export function parseThemeKey(value: string): { family: ThemeFamilyId; mode: ThemeMode } | null {
  if (!isThemeKey(value)) return null;
  const separator = value.lastIndexOf("-");
  const family = value.slice(0, separator);
  const mode = value.slice(separator + 1);
  if (!isThemeFamilyId(family) || !isThemeMode(mode)) return null;
  return { family, mode };
}

/** Maps any stored value (current key, legacy id, garbage) to a valid ThemeKey. */
export function resolveThemeKey(stored: string | null | undefined): ThemeKey {
  if (isThemeKey(stored)) return stored;
  if (typeof stored === "string" && Object.hasOwn(LEGACY_THEME_MAP, stored)) {
    return LEGACY_THEME_MAP[stored];
  }
  return DEFAULT_THEME_KEY;
}

/**
 * Builds the next-themes `value` map: every current key and every legacy id → CSS class.
 * Null prototype so stored values like "__proto__" or "toString" resolve to undefined
 * (next-themes then adds no class at runtime instead of throwing InvalidCharacterError).
 */
export function getThemeClassMap(): Readonly<Record<string, string>> {
  const map = Object.create(null) as Record<string, string>;
  for (const key of THEME_KEYS) map[key] = `theme-${key}`;
  for (const [legacyId, key] of Object.entries(LEGACY_THEME_MAP)) map[legacyId] = `theme-${key}`;
  return Object.freeze(map);
}
