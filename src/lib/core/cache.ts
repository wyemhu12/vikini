// /lib/core/cache.ts
// Redis caching utilities for conversations and gems lists
import { getSharedRedis } from "./redis.server";
import { logger } from "@/lib/utils/logger";

const MAX_SCAN_ITERATIONS = 50;
const SCAN_COUNT = 100;
const DEL_BATCH_SIZE = 100;

function getRedis() {
  return getSharedRedis();
}

// Cache key prefixes
const CACHE_KEYS = {
  conversations: (userId: string) => `cache:conversations:${userId}`,
  gems: (userId: string) => `cache:gems:${userId}`,
} as const;

// TTL constants (in seconds)
const TTL = {
  CONVERSATIONS: 60, // 60 seconds
  GEMS: 300, // 5 minutes
} as const;

/**
 * Get cached conversations list for a user
 */
export async function getCachedConversations<T>(userId: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const key = CACHE_KEYS.conversations(userId);
    const cached = await r.get(key);
    if (!cached) return null;

    // Upstash Redis may return already-parsed object or string
    if (typeof cached === "string") {
      return JSON.parse(cached) as T;
    }
    // Already an object (Upstash auto-deserializes JSON)
    return cached as T;
  } catch (error) {
    logger.warn("Failed to get cached conversations:", error);
    return null;
  }
}

/**
 * Set cached conversations list for a user
 */
export async function setCachedConversations<T>(userId: string, data: T): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    const key = CACHE_KEYS.conversations(userId);
    await r.setex(key, TTL.CONVERSATIONS, JSON.stringify(data));
  } catch (error) {
    logger.warn("Failed to set cached conversations:", error);
  }
}

/**
 * Invalidate cached conversations list for a user
 */
export async function invalidateConversationsCache(userId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    const key = CACHE_KEYS.conversations(userId);
    await r.del(key);
  } catch (error) {
    logger.warn("Failed to invalidate conversations cache:", error);
  }
}

/**
 * Get cached gems list for a user
 */
export async function getCachedGems<T>(userId: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const key = CACHE_KEYS.gems(userId);
    const cached = await r.get(key);
    if (!cached) return null;

    // Upstash Redis may return already-parsed object or string
    if (typeof cached === "string") {
      return JSON.parse(cached) as T;
    }
    // Already an object (Upstash auto-deserializes JSON)
    return cached as T;
  } catch (error) {
    logger.warn("Failed to get cached gems:", error);
    return null;
  }
}

/**
 * Set cached gems list for a user
 */
export async function setCachedGems<T>(userId: string, data: T): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    const key = CACHE_KEYS.gems(userId);
    await r.setex(key, TTL.GEMS, JSON.stringify(data));
  } catch (error) {
    logger.warn("Failed to set cached gems:", error);
  }
}

/**
 * Invalidate cached gems list for a user
 */
export async function invalidateGemsCache(userId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    const key = CACHE_KEYS.gems(userId);
    await r.del(key);
  } catch (error) {
    logger.warn("Failed to invalidate gems cache:", error);
  }
}

/**
 * Invalidate cached gems lists for all users (e.g., when admin modifies premade gems).
 * Uses non-blocking cursor SCAN with a hard iteration cap and batched DEL.
 */
export async function invalidateAllGemsCache(): Promise<void> {
  const r = getRedis();
  if (!r) return;

  try {
    let cursor: string | number = 0;
    let iterations = 0;

    while (iterations < MAX_SCAN_ITERATIONS) {
      iterations += 1;
      const [nextCursor, keys]: [string | number, string[]] = await r.scan(cursor, {
        match: "cache:gems:*",
        count: SCAN_COUNT,
      });

      if (Array.isArray(keys) && keys.length > 0) {
        for (let i = 0; i < keys.length; i += DEL_BATCH_SIZE) {
          const batch = keys.slice(i, i + DEL_BATCH_SIZE);
          if (batch.length > 0) {
            await r.del(...batch);
          }
        }
      }

      cursor = nextCursor;
      if (String(nextCursor) === "0") {
        return;
      }
    }

    logger.warn(
      `invalidateAllGemsCache reached max scan iterations (${MAX_SCAN_ITERATIONS}); remaining keys will expire via TTL`
    );
  } catch (error) {
    logger.warn("Failed to invalidate all gems cache:", error);
  }
}
