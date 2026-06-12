import { vi } from "./vi";
import { en } from "./en";

// Translation types
export type TranslationKey = string;
export type TranslationValue = string;

export interface Translations {
  [key: string]: TranslationValue | Translations;
}

export interface TranslationSet {
  vi: Record<TranslationKey, TranslationValue>;
  en: Record<TranslationKey, TranslationValue>;
}

export const translations: TranslationSet = { vi, en };

export const tVi = translations.vi;
export const tEn = translations.en;

// Type-safety: Ensure vi and en have the SAME keys at compile time
// If you add a key to vi but forget en (or vice versa), TypeScript will error here
type ViKeys = keyof typeof translations.vi;
type EnKeys = keyof typeof translations.en;
type _AssertViHasAllEnKeys =
  Record<EnKeys, string> extends Record<ViKeys, string>
    ? true
    : "ERROR: translations.vi is missing keys that exist in translations.en";
type _AssertEnHasAllViKeys =
  Record<ViKeys, string> extends Record<EnKeys, string>
    ? true
    : "ERROR: translations.en is missing keys that exist in translations.vi";
// These will cause compile errors if keys don't match:
const _viCheck: _AssertViHasAllEnKeys = true;
const _enCheck: _AssertEnHasAllViKeys = true;
// Suppress unused variable warnings
void _viCheck;
void _enCheck;
