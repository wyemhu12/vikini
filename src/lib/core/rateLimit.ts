// /lib/core/rateLimit.ts
// Atomic sliding-window rate limit using Upstash Redis Lua script (1 RTT).
// Fallback: bounded in-memory fixed window (per serverless instance).

import crypto from "crypto";
import { getSharedRedis } from "./redis.server";
import { logger } from "@/lib/utils/logger";

const rateLimitLogger = logger.withContext("rateLimit");

export const WINDOW_SECONDS = 60;
export const MAX_REQUESTS_PER_WINDOW = 20;

interface RateLimitConfig {
  windowSeconds: number;
  limit: number;
}

export interface RateLimitResult {
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

// Atomic sliding-window Lua script (1 RTT):
// KEYS[1] = "rl:<key>"
// ARGV = [nowMs, windowMs, limit, member, ttlSeconds]
// 1. Evict timestamps older than (nowMs - windowMs)
// 2. Check current ZCARD BEFORE adding (rejected retries never extend lockout)
// 3. ZADD + EXPIRE only when allowed
// 4. Return { allowed (1|0), count, oldestScore }
export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttl_sec = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)
local allowed = 0

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl_sec)
  count = count + 1
  allowed = 1
end

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_score = now
if oldest and #oldest >= 2 then
  oldest_score = tonumber(oldest[2]) or now
end

return { allowed, count, oldest_score }
`;

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getConfig(): RateLimitConfig {
  const windowSeconds = toPositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS, WINDOW_SECONDS);
  const limit = toPositiveInt(process.env.RATE_LIMIT_MAX, MAX_REQUESTS_PER_WINDOW);
  return { windowSeconds, limit };
}

// ------------------------------
// Fallback: bounded in-memory fixed-window limiter
// ------------------------------
const memStore = new Map<string, MemoryEntry>();

// Maximum entries to prevent unbounded memory growth in serverless
export const MAX_MEM_STORE_ENTRIES = 10000;
let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 30000; // 30 seconds

/**
 * Lazy cleanup: evicts expired entries periodically and enforces hard size ceiling.
 */
function cleanupExpiredEntries(now: number, windowMs: number, force = false): void {
  if (!force && now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;

  for (const [key, entry] of memStore.entries()) {
    if (now - entry.start > windowMs) {
      memStore.delete(key);
    }
  }

  // Enforce hard ceiling using FIFO insertion order when under high-cardinality flood
  while (memStore.size >= MAX_MEM_STORE_ENTRIES) {
    const oldestKey = memStore.keys().next().value;
    if (oldestKey === undefined) break;
    memStore.delete(oldestKey);
  }
}

export function resetInMemoryRateLimitForTests(): void {
  memStore.clear();
  lastCleanupTime = 0;
}

export function getInMemoryStoreSizeForTests(): number {
  return memStore.size;
}

async function consumeInMemory(
  key: string,
  { windowSeconds, limit }: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = memStore.get(key);

  // Evict proactively if expired sweep is due OR inserting a new key would breach ceiling
  cleanupExpiredEntries(now, windowMs, !existing && memStore.size >= MAX_MEM_STORE_ENTRIES);

  let currentEntry: MemoryEntry;
  if (!existing || now - existing.start > windowMs) {
    if (existing) memStore.delete(key);
    currentEntry = { count: 0, start: now };
    memStore.set(key, currentEntry);
  } else {
    currentEntry = existing;
  }

  const allowed = currentEntry.count < limit;
  if (allowed) {
    currentEntry.count += 1;
  }

  const resetInMs = Math.max(0, windowMs - (now - currentEntry.start));
  const remaining = Math.max(0, limit - currentEntry.count);

  return {
    allowed,
    limit,
    remaining,
    resetInMs,
    retryAfterSeconds: Math.max(1, Math.ceil(resetInMs / 1000)),
    backend: "memory",
  };
}

// ------------------------------
// Upstash atomic sliding-window limiter
// ------------------------------
async function consumeUpstash(
  key: string,
  { windowSeconds, limit }: RateLimitConfig
): Promise<RateLimitResult> {
  const r = getSharedRedis();
  if (!r) return consumeInMemory(key, { windowSeconds, limit });

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const k = `rl:${key}`;
  const member = `${now}:${crypto.randomUUID()}`;

  try {
    const raw = await r.eval<
      [number, number, number, string, number],
      [number, number, number | string]
    >(SLIDING_WINDOW_LUA, [k], [now, windowMs, limit, member, windowSeconds + 5]);

    if (!Array.isArray(raw) || raw.length < 3) {
      throw new Error("Unexpected Lua rate limit response");
    }

    const allowed = Number(raw[0]) === 1;
    const count = Number(raw[1]) || 0;
    const oldestScore = Number(raw[2]);
    const resetInMs = Number.isFinite(oldestScore)
      ? Math.max(0, windowMs - (now - oldestScore))
      : windowMs;

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      resetInMs,
      retryAfterSeconds: Math.max(1, Math.ceil(resetInMs / 1000)),
      backend: "upstash",
    };
  } catch (err: unknown) {
    rateLimitLogger.warn("Upstash rate limit failed, falling back to in-memory:", err);
    return consumeInMemory(key, { windowSeconds, limit });
  }
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
