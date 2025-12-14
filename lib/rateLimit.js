export const WINDOW_MS = 60 * 1000; // 1 minute
export const MAX_REQUESTS_PER_WINDOW = 20;

// In-memory store (per serverless instance on Vercel)
const store = new Map();

/**
 * Consume 1 request from a fixed-window limiter.
 * Returns status to allow API layer to respond with Retry-After, etc.
 */
export function consumeRateLimit(key) {
  const now = Date.now();
  const entry = store.get(key) || { count: 0, start: now };

  // reset window
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  store.set(key, entry);

  const allowed = entry.count <= MAX_REQUESTS_PER_WINDOW;
  const resetInMs = Math.max(0, WINDOW_MS - (now - entry.start));
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count);

  return {
    allowed,
    limit: MAX_REQUESTS_PER_WINDOW,
    remaining,
    resetInMs,
  };
}

/**
 * Backward-compatible helper (boolean).
 */
export function checkRateLimit(key) {
  return consumeRateLimit(key).allowed;
}
