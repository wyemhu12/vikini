/**
 * Typewriter Buffer & Dynamic Chunking Module
 * Decouples network token streaming from visual rendering for smooth ~30fps UI updates.
 */

export const BASE_CHARS_PER_TICK = 2;
export const MIN_INTERVAL_MS = 30; // Target ~30fps to avoid blocking main thread

/**
 * Pure function computing chunk size based on backlog length
 *
 * @param bufferLen - The current length of unrendered character buffer
 * @returns Number of characters to take in the next tick
 */
export function computeCharsToTake(bufferLen: number): number {
  if (bufferLen > 200) return Math.floor(bufferLen / 3);
  if (bufferLen > 80) return 12;
  if (bufferLen > 30) return 6;
  return BASE_CHARS_PER_TICK;
}
