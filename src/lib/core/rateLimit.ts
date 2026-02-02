// /lib/core/rateLimit.ts
// Sliding-window rate limit using Upstash Redis when available.
// Fallback: in-memory fixed window (per serverless instance).

import crypto from "crypto";
import { Redis } from "@upstash/redis";

export const WINDOW_SECONDS = 60;
export const MAX_REQUESTS_PER_WINDOW = 20;

interface RateLimitConfig {
  windowSeconds: number;
  limit: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
  retryAfterSeconds: number;
  backend: "memory" | "upstash";
}

interface MemoryEntry {
  count: number;
  start: number;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getConfig(): RateLimitConfig {
  const windowSeconds = toPositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS, WINDOW_SECONDS);
  const limit = toPositiveInt(process.env.RATE_LIMIT_MAX, MAX_REQUESTS_PER_WINDOW);
  return { windowSeconds, limit };
}

let redis: Redis | null = null;
function getRedisOptional(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ------------------------------
// Fallback: in-memory fixed-window limiter
// ------------------------------
const memStore = new Map<string, MemoryEntry>();

// Maximum entries to prevent unbounded memory growth in serverless
const MAX_MEM_STORE_ENTRIES = 10000;
let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 30000; // 30 seconds - more aggressive cleanup for high-traffic

/**
 * Lazy cleanup: runs during consumeInMemory calls instead of setInterval.
 * This avoids memory leaks from orphaned intervals in serverless environments.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Only cleanup once per minute to avoid performance overhead
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  const windowMs = getConfig().windowSeconds * 1000;

  for (const [key, entry] of memStore.entries()) {
    if (now - entry.start > windowMs) {
      memStore.delete(key);
    }
  }

  // If still too many entries after cleanup, remove oldest ones
  if (memStore.size > MAX_MEM_STORE_ENTRIES) {
    const entries = Array.from(memStore.entries());
    entries.sort((a, b) => a[1].start - b[1].start);
    const toRemove = entries.slice(0, memStore.size - MAX_MEM_STORE_ENTRIES);
    for (const [key] of toRemove) {
      memStore.delete(key);
    }
  }
}

async function consumeInMemory(
  key: string,
  { windowSeconds, limit }: RateLimitConfig
): Promise<RateLimitResult> {
  // Lazy cleanup - runs periodically during normal operations
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memStore.get(key);

  // If entry exists but is expired, reset or delete
  if (entry && now - entry.start > windowMs) {
    memStore.delete(key);
  }

  const currentEntry = memStore.get(key) || { count: 0, start: now };
  currentEntry.count += 1;
  memStore.set(key, currentEntry);

  const allowed = currentEntry.count <= limit;
  const resetInMs = Math.max(0, windowMs - (now - currentEntry.start));
  const remaining = Math.max(0, limit - currentEntry.count);

  return {
    allowed,
    limit,
    remaining,
    resetInMs,
    retryAfterSeconds: Math.ceil(resetInMs / 1000),
    backend: "memory",
  };
}

// ------------------------------
// Upstash sliding-window limiter
// ------------------------------
async function consumeUpstash(
  key: string,
  { windowSeconds, limit }: RateLimitConfig
): Promise<RateLimitResult> {
  const r = getRedisOptional();
  if (!r) return consumeInMemory(key, { windowSeconds, limit });

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const start = now - windowMs;
  const k = `rl:${key}`;

  // Unique member to avoid collisions within same millisecond
  const member = `${now}:${crypto.randomUUID()}`;

  // Pipeline:
  // 1) add current timestamp
  // 2) remove old timestamps
  // 3) count
  // 4) expire
  const pipe = r.multi();
  pipe.zadd(k, { score: now, member });
  pipe.zremrangebyscore(k, 0, start);
  pipe.zcard(k);
  pipe.expire(k, windowSeconds + 5);
  const results = await pipe.exec();

  const count = Number(results?.[2] || 0);
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  let resetInMs = windowMs;
  try {
    // get oldest timestamp in window to compute retry-after
    const oldest = await r.zrange(k, 0, 0, { withScores: true });
    const score =
      Array.isArray(oldest) && oldest.length > 0
        ? Number((oldest[0] as { score?: number })?.score)
        : NaN;
    if (Number.isFinite(score)) {
      resetInMs = Math.max(0, windowMs - (now - score));
    }
  } catch {
    resetInMs = windowMs;
  }

  return {
    allowed,
    limit,
    remaining,
    resetInMs,
    retryAfterSeconds: Math.ceil(resetInMs / 1000),
    backend: "upstash",
  };
}

/**
 * Consume 1 request from limiter.
 */
export async function consumeRateLimit(key: string): Promise<RateLimitResult> {
  const cfg = getConfig();
  return consumeUpstash(key, cfg);
}

/**
 * Backward-compatible helper (boolean).
 */
export async function checkRateLimit(key: string): Promise<boolean> {
  const r = await consumeRateLimit(key);
  return r.allowed;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const resetSeconds = Math.ceil(Number(result?.resetInMs || 0) / 1000);
  return {
    "X-RateLimit-Limit": String(result?.limit ?? ""),
    "X-RateLimit-Remaining": String(result?.remaining ?? ""),
    "X-RateLimit-Reset": String(resetSeconds),
    ...(result?.allowed
      ? {}
      : { "Retry-After": String(result?.retryAfterSeconds ?? resetSeconds) }),
  };
}
