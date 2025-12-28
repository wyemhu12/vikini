// /lib/core/rateLimit.js
// Sliding-window rate limit using Upstash Redis when available.
// Fallback: in-memory fixed window (per serverless instance).

import crypto from "crypto";
import { Redis } from "@upstash/redis";

export const WINDOW_SECONDS = 60;
export const MAX_REQUESTS_PER_WINDOW = 20;

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getConfig() {
  const windowSeconds = toPositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS, WINDOW_SECONDS);
  const limit = toPositiveInt(process.env.RATE_LIMIT_MAX, MAX_REQUESTS_PER_WINDOW);
  return { windowSeconds, limit };
}

let redis;
function getRedisOptional() {
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
const memStore = new Map();

async function consumeInMemory(key, { windowSeconds, limit }) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memStore.get(key) || { count: 0, start: now };

  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count += 1;
  memStore.set(key, entry);

  const allowed = entry.count <= limit;
  const resetInMs = Math.max(0, windowMs - (now - entry.start));
  const remaining = Math.max(0, limit - entry.count);

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
async function consumeUpstash(key, { windowSeconds, limit }) {
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
    const score = Array.isArray(oldest) && oldest.length > 0 ? Number(oldest[0]?.score) : NaN;
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
export async function consumeRateLimit(key) {
  const cfg = getConfig();
  return consumeUpstash(key, cfg);
}

/**
 * Backward-compatible helper (boolean).
 */
export async function checkRateLimit(key) {
  const r = await consumeRateLimit(key);
  return r.allowed;
}

export function rateLimitHeaders(result) {
  const resetSeconds = Math.ceil(Number(result?.resetInMs || 0) / 1000);
  return {
    "X-RateLimit-Limit": String(result?.limit ?? ""),
    "X-RateLimit-Remaining": String(result?.remaining ?? ""),
    "X-RateLimit-Reset": String(resetSeconds),
    ...(result?.allowed ? {} : { "Retry-After": String(result?.retryAfterSeconds ?? resetSeconds) }),
  };
}
