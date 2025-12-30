// /lib/core/cache.ts
// Redis caching utilities for conversations and gems lists
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      logger.warn(
        "Redis cache not available: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
      );
      return null;
    }

    try {
      redis = new Redis({ url, token });
    } catch (error) {
      logger.error("Failed to initialize Redis cache:", error);
      return null;
    }
  }
  return redis;
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
