// /lib/features/novelcrafter/manuscriptTypography.ts
// Typography types, defaults, and strict sanitizer for the Novelcrafter Manuscript Editor

export type ManuscriptFontFamily = "serif" | "sans" | "mono";
export type ManuscriptFontSize = "sm" | "md" | "lg" | "xl";
export type ManuscriptLineHeight = "compact" | "normal" | "relaxed";

export interface ManuscriptTypography {
  fontFamily: ManuscriptFontFamily;
  fontSize: ManuscriptFontSize;
  lineHeight: ManuscriptLineHeight;
  paragraphIndent: boolean;
}

export const DEFAULT_MANUSCRIPT_TYPOGRAPHY: ManuscriptTypography = {
  fontFamily: "serif",
  fontSize: "md",
  lineHeight: "normal",
  paragraphIndent: false,
};

export const MANUSCRIPT_TYPOGRAPHY_STORAGE_KEY = "vikini:nc-manuscript-typography:v1";

const VALID_FONT_FAMILIES: readonly ManuscriptFontFamily[] = ["serif", "sans", "mono"];
const VALID_FONT_SIZES: readonly ManuscriptFontSize[] = ["sm", "md", "lg", "xl"];
const VALID_LINE_HEIGHTS: readonly ManuscriptLineHeight[] = ["compact", "normal", "relaxed"];

export function sanitizeManuscriptTypography(raw: unknown): ManuscriptTypography {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_MANUSCRIPT_TYPOGRAPHY };
  }

  const record = raw as Record<string, unknown>;
  const fontFamily = VALID_FONT_FAMILIES.includes(record.fontFamily as ManuscriptFontFamily)
    ? (record.fontFamily as ManuscriptFontFamily)
    : DEFAULT_MANUSCRIPT_TYPOGRAPHY.fontFamily;

  const fontSize = VALID_FONT_SIZES.includes(record.fontSize as ManuscriptFontSize)
    ? (record.fontSize as ManuscriptFontSize)
    : DEFAULT_MANUSCRIPT_TYPOGRAPHY.fontSize;

  const lineHeight = VALID_LINE_HEIGHTS.includes(record.lineHeight as ManuscriptLineHeight)
    ? (record.lineHeight as ManuscriptLineHeight)
    : DEFAULT_MANUSCRIPT_TYPOGRAPHY.lineHeight;

  const paragraphIndent =
    typeof record.paragraphIndent === "boolean"
      ? record.paragraphIndent
      : DEFAULT_MANUSCRIPT_TYPOGRAPHY.paragraphIndent;

  return {
    fontFamily,
    fontSize,
    lineHeight,
    paragraphIndent,
  };
}
