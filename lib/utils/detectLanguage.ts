// lib/utils/detectLanguage.ts
/**
 * Simple heuristic language detection based on character analysis.
 * Detects Vietnamese, German, or defaults to English.
 */

// Vietnamese diacritics pattern
const VIETNAMESE_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi;

// German-specific characters (umlauts and ß)
const GERMAN_CHARS = /[äöüßÄÖÜ]/g;

// Common German words for additional detection
const GERMAN_WORDS =
  /\b(der|die|das|und|ist|von|mit|auf|für|ein|eine|nicht|sich|auch|als|bei|nach|aus|wenn|aber|oder|noch|wie|nur|können|haben|werden|sein|ich|du|er|sie|es|wir|ihr)\b/gi;

export type DetectedLanguage = "vi-VN" | "de-DE" | "en-US";

/**
 * Detect the primary language of a text string.
 *
 * @param text - The text to analyze
 * @returns The detected language code for TTS
 *
 * @example
 * detectLanguage("Xin chào bạn!") // "vi-VN"
 * detectLanguage("Guten Tag, wie geht's?") // "de-DE"
 * detectLanguage("Hello world!") // "en-US"
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length === 0) {
    return "en-US";
  }

  const cleanText = text.trim();
  const textLength = cleanText.length;

  // Check for Vietnamese (high priority due to unique diacritics)
  const vnMatches = cleanText.match(VIETNAMESE_CHARS);
  if (vnMatches && vnMatches.length > textLength * 0.02) {
    return "vi-VN";
  }

  // Check for German
  const germanCharMatches = cleanText.match(GERMAN_CHARS);
  const germanWordMatches = cleanText.match(GERMAN_WORDS);

  // German detection: either has umlauts/ß or multiple common German words
  if (germanCharMatches && germanCharMatches.length > 0) {
    return "de-DE";
  }
  if (germanWordMatches && germanWordMatches.length >= 3) {
    return "de-DE";
  }

  // Default to English
  return "en-US";
}

/**
 * Get a human-readable language name
 */
export function getLanguageName(code: DetectedLanguage): string {
  const names: Record<DetectedLanguage, string> = {
    "vi-VN": "Tiếng Việt",
    "de-DE": "Deutsch",
    "en-US": "English",
  };
  return names[code] || "English";
}
