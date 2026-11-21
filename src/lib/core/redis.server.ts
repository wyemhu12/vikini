// /lib/core/redis.server.ts
// Single shared Upstash Redis singleton for server-side modules.

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

const redisLogger = logger.withContext("redis");

let cachedRedis: Redis | null = null;
let cachedCredentialsKey = "";

/**
 * Returns the shared Upstash Redis client, or null when unconfigured.
 * Recreates the client automatically if env credentials change.
 */
export function getSharedRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  const credentialsKey = `${url}\0${token}`;
  if (cachedRedis && cachedCredentialsKey === credentialsKey) {
    return cachedRedis;
  }

  try {
    cachedRedis = new Redis({ url, token });
    cachedCredentialsKey = credentialsKey;
    return cachedRedis;
  } catch (err: unknown) {
    redisLogger.error("Failed to initialize Upstash Redis client:", err);
    return null;
  }
}

/**
 * Resets cached Redis singleton (for isolated unit tests).
 */
export function resetSharedRedisForTests(): void {
  cachedRedis = null;
  cachedCredentialsKey = "";
}
