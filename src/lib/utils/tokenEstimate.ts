// src/lib/utils/tokenEstimate.ts
/**
 * Token Estimation Utilities (Multilingual)
 *
 * Placed in src/lib/utils to satisfy layer boundaries (lib cannot import from app).
 * Calibrated for BPE tokenizers with Vietnamese, CJK, ASCII, and Unicode support.
 */

/**
 * Estimates the number of tokens in a string.
 *
 * Token estimation for different text types:
 * - English/ASCII: ~4 chars/token
 * - Vietnamese: ~2.0 chars/token (syllabic with diacritics)
 * - CJK (Chinese/Japanese/Korean): ~1.5 chars/token
 * - Other Unicode: ~2 chars/token
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;

  // Count different character types
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || [])
    .length;
  const vietnameseChars = (
    text.match(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi) || []
  ).length;
  const asciiChars = (text.match(/[\x20-\x7E]/g) || []).length;
  const otherChars = text.length - cjkChars - vietnameseChars - asciiChars;

  // Weighted token estimation:
  // - CJK: 1.5 chars/token
  // - Vietnamese: 2.0 chars/token (calibrated)
  // - ASCII: 4 chars/token
  // - Other: 2 chars/token
  const cjkTokens = cjkChars / 1.5;
  const vietTokens = vietnameseChars / 2.0;
  const asciiTokens = asciiChars / 4;
  const otherTokens = otherChars / 2;

  // 10% safety margin
  const total = cjkTokens + vietTokens + asciiTokens + otherTokens;
  return Math.ceil(total * 1.1);
}

/**
 * Estimate character budget from available tokens.
 * Default ratio: 1.8 chars/token for conservative multilingual safety.
 */
export function estimateCharBudget(tokens: number, ratio: number = 1.8): number {
  if (tokens <= 0) return 0;
  return Math.floor(tokens * ratio);
}
