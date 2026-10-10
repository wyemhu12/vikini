import { vi } from "./vi";
import { en } from "./en";

// Translation types
export type TranslationKey = keyof typeof en;
export type TranslationValue = string;

export interface Translations {
  [key: string]: TranslationValue | Translations;
}

export interface TranslationSet {
  vi: Record<string, TranslationValue>;
  en: Record<string, TranslationValue>;
}

export const translations = { vi, en };

export const tVi = translations.vi;
export const tEn = translations.en;

// Compile-time bidirectional parity enforcement:
// Ensures vi.ts and en.ts have EXACTLY the same keys.
type MissingInVi = Exclude<keyof typeof en, keyof typeof vi>;
type MissingInEn = Exclude<keyof typeof vi, keyof typeof en>;
type _AssertTranslationsParity = [MissingInVi, MissingInEn] extends [never, never]
  ? true
  : {
      error: "Compile Error: Translation keys mismatch between vi.ts and en.ts";
      missingInVi: MissingInVi;
      missingInEn: MissingInEn;
    };
const _parityAssertion: _AssertTranslationsParity = true;
void _parityAssertion;
