// /lib/features/novelcrafter/writeLength.ts
// Pure helper to clamp and sanitize custom Write word-count input (50-4000 words)

import { MAX_WRITE_LENGTH_WORDS, MIN_WRITE_LENGTH_WORDS } from "./types";

export function clampWriteLengthWords(raw: unknown, fallback = 300): number {
  let num: number;
  if (typeof raw === "number") {
    num = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    num = Number(trimmed);
  } else {
    return fallback;
  }

  if (!Number.isFinite(num)) {
    return fallback;
  }

  const rounded = Math.round(num);
  return Math.min(MAX_WRITE_LENGTH_WORDS, Math.max(MIN_WRITE_LENGTH_WORDS, rounded));
}
