// /lib/core/batchGenQuota.ts
// Batch generation quota management with Upstash Redis

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

const batchLogger = logger.withContext("batch-gen-quota");

// =====================================================================================
// Types
// =====================================================================================

export interface BatchGenLimitConfig {
  maxBatchSize: number;
  quotas: Record<number, number>;
}

// =====================================================================================
// Rank-Based Limits
// =====================================================================================

export const BATCH_GEN_LIMITS: Record<string, BatchGenLimitConfig> = {
  basic: { maxBatchSize: 2, quotas: { 2: 10 } },
  pro: { maxBatchSize: 3, quotas: { 2: 10, 3: 10 } },
  admin: { maxBatchSize: 4, quotas: { 2: 999, 3: 999, 4: 999 } },
  not_whitelisted: { maxBatchSize: 1, quotas: {} },
};

// =====================================================================================
// Redis Client
// =====================================================================================

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// =====================================================================================
// Helpers
// =====================================================================================

const DAY_TTL_SECONDS = 86400;

/**
 * Increment batch generation usage counter for a user.
 * Key pattern: batch-gen:{userId}:{YYYY-MM-DD}:{batchSize}
 * TTL: 24 hours (auto-expires)
 */
export async function incrementBatchGenUsage(userId: string, batchSize: number): Promise<number> {
  const r = getRedis();
  if (!r) {
    batchLogger.warn("Redis unavailable, skipping batch gen usage tracking");
    return 0;
  }

  const today = new Date().toISOString().split("T")[0];
  const key = `batch-gen:${userId}:${today}:${batchSize}`;

  try {
    const count = await r.incr(key);
    // Set TTL only on first increment (when count is 1)
    if (count === 1) {
      await r.expire(key, DAY_TTL_SECONDS);
    }
    return count;
  } catch (err: unknown) {
    batchLogger.error("Failed to increment batch gen usage:", err);
    return 0;
  }
}
