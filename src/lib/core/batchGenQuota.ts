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

export type BatchGenClaimResult =
  | { claimed: true; rollback: () => Promise<void> }
  | {
      claimed: false;
      reason: string;
      code: "BATCH_SIZE_EXCEEDS_RANK" | "BATCH_GEN_LIMIT_EXCEEDED" | "SERVICE_UNAVAILABLE";
    };

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
// In-Memory Dev Fallback (m-37)
// =====================================================================================

const inMemoryQuotaStore = new Map<string, number>();

export function resetInMemoryQuotaStore(): void {
  inMemoryQuotaStore.clear();
}

function claimInMemoryFallback(key: string, quota: number): BatchGenClaimResult {
  const current = inMemoryQuotaStore.get(key) || 0;
  const count = current + 1;
  inMemoryQuotaStore.set(key, count);

  const rollback = async () => {
    const val = inMemoryQuotaStore.get(key) || 0;
    if (val > 0) inMemoryQuotaStore.set(key, val - 1);
  };

  if (count > quota) {
    void rollback();
    return {
      claimed: false,
      reason: "Daily batch generation limit reached",
      code: "BATCH_GEN_LIMIT_EXCEEDED",
    };
  }

  return { claimed: true, rollback };
}

// =====================================================================================
// Helpers & Atomic Claim
// =====================================================================================

const DAY_TTL_SECONDS = 86400;

/**
 * Atomically claim a batch generation slot for a user.
 * Increments quota counter in Redis and immediately rolls back if limit exceeded.
 */
export async function tryClaimBatchGenSlot(
  userId: string,
  rank: string,
  batchSize: number
): Promise<BatchGenClaimResult> {
  // Single image generations do not consume batch generation quota
  if (batchSize <= 1) {
    return { claimed: true, rollback: async () => {} };
  }

  const config = BATCH_GEN_LIMITS[rank] || BATCH_GEN_LIMITS.basic;

  if (batchSize > config.maxBatchSize) {
    return {
      claimed: false,
      reason: `Batch size ${batchSize} exceeds rank limit (${config.maxBatchSize})`,
      code: "BATCH_SIZE_EXCEEDS_RANK",
    };
  }

  const quota = config.quotas[batchSize];
  if (quota === undefined) {
    return {
      claimed: false,
      reason: `Batch size ${batchSize} not permitted for rank ${rank}`,
      code: "BATCH_SIZE_EXCEEDS_RANK",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const key = `batch-gen:${userId}:${today}:${batchSize}`;

  const r = getRedis();
  if (!r) {
    if (process.env.NODE_ENV === "development") {
      return claimInMemoryFallback(key, quota);
    }
    return {
      claimed: false,
      reason: "Rate limiting service temporarily unavailable",
      code: "SERVICE_UNAVAILABLE",
    };
  }

  try {
    const count = await r.incr(key);
    if (count === 1) {
      try {
        await r.expire(key, DAY_TTL_SECONDS);
      } catch (e) {
        batchLogger.error("Failed to set TTL:", e);
      }
    }

    const rollback = async () => {
      try {
        await r.decr(key);
      } catch (e) {
        batchLogger.error("Rollback failed:", e);
      }
    };

    if (count > quota) {
      await rollback();
      return {
        claimed: false,
        reason: "Daily batch generation limit reached",
        code: "BATCH_GEN_LIMIT_EXCEEDED",
      };
    }

    return { claimed: true, rollback };
  } catch (err: unknown) {
    batchLogger.error("Redis quota claim failed:", err);
    return {
      claimed: false,
      reason: "Rate limiting service error",
      code: "SERVICE_UNAVAILABLE",
    };
  }
}

/**
 * Legacy increment helper preserved for backwards compatibility.
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
    if (count === 1) {
      await r.expire(key, DAY_TTL_SECONDS);
    }
    return count;
  } catch (err: unknown) {
    batchLogger.error("Failed to increment batch gen usage:", err);
    return 0;
  }
}
