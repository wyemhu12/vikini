// /lib/core/contextCache.ts
// Explicit Context Caching for Gemini API
// Caches system instructions and GEM personas to reduce token costs (50-90% savings)
// @see https://ai.google.dev/gemini-api/docs/caching

import { getGenAIClient } from "@/lib/core/genaiClient";
import { logger } from "@/lib/utils/logger";

const cacheLogger = logger.withContext("contextCache");

/**
 * Minimum input token count for explicit caching to be effective.
 * Gemini 2.5+: varies per model, generally ~1024-2048 tokens minimum.
 * Below this threshold, caching overhead exceeds the savings.
 */
const MIN_CACHEABLE_CHARS = 4096; // ~1024 tokens (rough estimate at 4 chars/token)

/**
 * Default TTL for cached content in seconds.
 * GEM personas are typically stable across sessions — 1 hour is a good balance
 * between cost savings and storage fees.
 */
const DEFAULT_CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * In-memory map of cache names keyed by a composite key.
 * Format: `{model}:{hashOfContent}` -> `cachedContents/{id}`
 *
 * This avoids recreating caches for the same content on every request.
 * In a multi-instance deployment, each instance maintains its own map,
 * which is acceptable since Gemini API also deduplicates server-side.
 */
const activeCacheNames = new Map<string, { name: string; expiresAt: number }>();

/**
 * Simple hash for cache key deduplication.
 * Uses djb2 algorithm — fast, low collision for our use case.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build a composite cache key from model + system instruction content.
 */
function buildCacheKey(model: string, systemInstruction: string): string {
  return `${model}:${hashString(systemInstruction)}`;
}

interface CacheResult {
  /** The cache name to pass to generateContent config */
  cacheName: string;
  /** Whether this was a cache hit (reused) or miss (newly created) */
  cacheHit: boolean;
}

/**
 * Get or create an explicit cache for the given system instruction.
 *
 * Flow:
 * 1. Check in-memory map for an active cache
 * 2. If found and not expired, return the cache name (hit)
 * 3. If not found, create a new cache via `ai.caches.create()`
 * 4. Store the cache name in the in-memory map
 *
 * @param model - Gemini model ID (e.g., "gemini-3-flash-preview")
 * @param systemInstruction - The full system instruction text to cache
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 * @returns CacheResult with cache name, or null if caching is not applicable
 */
export async function getOrCreateSystemCache(
  model: string,
  systemInstruction: string,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
): Promise<CacheResult | null> {
  // Guard: skip if content is too short for caching to be cost-effective
  if (!systemInstruction || systemInstruction.length < MIN_CACHEABLE_CHARS) {
    cacheLogger.info(
      `Skipping cache: content too short (${systemInstruction?.length || 0} chars < ${MIN_CACHEABLE_CHARS} min)`
    );
    return null;
  }

  // Guard: only Gemini models support explicit caching
  if (!model.startsWith("gemini-")) {
    return null;
  }

  const cacheKey = buildCacheKey(model, systemInstruction);
  const now = Date.now();

  // Check in-memory map for active cache
  const existing = activeCacheNames.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    cacheLogger.info(`Cache HIT: ${cacheKey} → ${existing.name}`);
    return { cacheName: existing.name, cacheHit: true };
  }

  // Cache miss — create new
  try {
    const ai = getGenAIClient();

    const cache = await ai.caches.create({
      model,
      config: {
        systemInstruction,
        ttl: `${ttlSeconds}s`,
      },
    });

    if (!cache?.name) {
      cacheLogger.error("Cache creation returned no name");
      return null;
    }

    // Store in memory with expiration
    const expiresAt = now + ttlSeconds * 1000;
    activeCacheNames.set(cacheKey, { name: cache.name, expiresAt });

    cacheLogger.info(
      `Cache CREATED: ${cacheKey} → ${cache.name} (TTL: ${ttlSeconds}s, chars: ${systemInstruction.length})`
    );

    return { cacheName: cache.name, cacheHit: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    cacheLogger.error(`Cache creation failed: ${message}`);
    // Non-fatal: fall back to standard (uncached) request
    return null;
  }
}

/**
 * Cleanup expired entries from the in-memory cache map.
 * Called periodically to prevent memory leaks in long-running processes.
 */
export function cleanupExpiredCaches(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of activeCacheNames) {
    if (entry.expiresAt <= now) {
      activeCacheNames.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    cacheLogger.info(`Cleaned up ${cleaned} expired cache entries`);
  }

  return cleaned;
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): {
  activeCaches: number;
  oldestExpiresIn: number | null;
} {
  const now = Date.now();
  let oldestExpiresIn: number | null = null;

  for (const entry of activeCacheNames.values()) {
    const remaining = entry.expiresAt - now;
    if (remaining > 0 && (oldestExpiresIn === null || remaining < oldestExpiresIn)) {
      oldestExpiresIn = remaining;
    }
  }

  return {
    activeCaches: activeCacheNames.size,
    oldestExpiresIn,
  };
}
