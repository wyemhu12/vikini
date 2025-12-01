const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

const store = new Map();

export function checkRateLimit(key) {
  const now = Date.now();
  const entry = store.get(key) || { count: 0, start: now };

  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  store.set(key, entry);

  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}
