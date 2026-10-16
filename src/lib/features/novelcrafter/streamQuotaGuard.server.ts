// /lib/features/novelcrafter/streamQuotaGuard.server.ts
// Serverless-safe daily message quota reservation using Upstash Redis (NC-06, Q2, R1)

import { getRedis } from "@/lib/core/batchGenQuota";
import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import { AccessPendingError, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const quotaLogger = logger.withContext("streamQuotaGuard");

const INFLIGHT_KEY_PREFIX = "nc-stream-inflight";
const INFLIGHT_TTL_SECONDS = 360;

const localInFlightCounts = new Map<string, number>();

export function resetLocalInFlightQuotaForTests(): void {
  localInFlightCounts.clear();
}

function buildInFlightKey(userId: string): string {
  const utcDate = new Date().toISOString().slice(0, 10);
  return `${INFLIGHT_KEY_PREFIX}:${userId}:${utcDate}`;
}

function resolveUsableRedis(): ReturnType<typeof getRedis> {
  const r = getRedis();
  if (!r) return null;
  if (
    process.env.NODE_ENV === "test" &&
    process.env.UPSTASH_REDIS_REST_URL?.includes("test-redis.upstash.io") &&
    typeof r.incr === "function" &&
    !("mock" in r.incr)
  ) {
    return null;
  }
  return r;
}

export type StreamQuotaReservationResult =
  | {
      allowed: false;
      count: number;
      limit: number;
    }
  | {
      allowed: true;
      count: number;
      limit: number;
      onFirstModelOutput: () => void;
      releaseReservation: () => Promise<void>;
    };

export async function reserveNovelcrafterStreamQuota(
  userId: string
): Promise<StreamQuotaReservationResult> {
  const redis = resolveUsableRedis();
  const key = buildInFlightKey(userId);

  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("Quota service temporarily unavailable", 503, "QUOTA_SERVICE_UNAVAILABLE");
    }

    const currentInFlight = (localInFlightCounts.get(key) ?? 0) + 1;
    localInFlightCounts.set(key, currentInFlight);

    try {
      const dailyCheck = await checkDailyMessageLimit(userId);
      if (dailyCheck.rank === "not_whitelisted") {
        throw new AccessPendingError();
      }

      const effectiveCount = dailyCheck.count + currentInFlight;
      if (!dailyCheck.canSend || effectiveCount > dailyCheck.limit) {
        const nextVal = Math.max(0, (localInFlightCounts.get(key) ?? 1) - 1);
        if (nextVal === 0) localInFlightCounts.delete(key);
        else localInFlightCounts.set(key, nextVal);
        return {
          allowed: false,
          count: Math.max(dailyCheck.count, effectiveCount - 1),
          limit: dailyCheck.limit,
        };
      }

      let committed = false;
      let released = false;
      let commitPromise: Promise<void> | null = null;

      return {
        allowed: true,
        count: effectiveCount,
        limit: dailyCheck.limit,
        onFirstModelOutput: () => {
          if (committed) return;
          committed = true;
          commitPromise = Promise.resolve(incrementDailyMessageCount(userId)).catch(
            (err: unknown) => {
              quotaLogger.error("Failed to increment daily message count:", err);
            }
          );
        },
        releaseReservation: async () => {
          if (released) return;
          released = true;
          if (commitPromise) {
            await commitPromise;
          }
          const nextVal = Math.max(0, (localInFlightCounts.get(key) ?? 1) - 1);
          if (nextVal === 0) localInFlightCounts.delete(key);
          else localInFlightCounts.set(key, nextVal);
        },
      };
    } catch (err: unknown) {
      const nextVal = Math.max(0, (localInFlightCounts.get(key) ?? 1) - 1);
      if (nextVal === 0) localInFlightCounts.delete(key);
      else localInFlightCounts.set(key, nextVal);
      throw err;
    }
  }

  // Step 1: Execute redis.incr(key) OUTSIDE try-catch so a failed incr never triggers decr
  const inFlight = await redis.incr(key);

  try {
    if (inFlight === 1) {
      await redis.expire(key, INFLIGHT_TTL_SECONDS);
    }

    const dailyCheck = await checkDailyMessageLimit(userId);
    if (dailyCheck.rank === "not_whitelisted") {
      throw new AccessPendingError();
    }

    const effectiveCount = dailyCheck.count + inFlight;

    if (!dailyCheck.canSend || effectiveCount > dailyCheck.limit) {
      await redis.decr(key);
      return {
        allowed: false,
        count: Math.max(dailyCheck.count, effectiveCount - 1),
        limit: dailyCheck.limit,
      };
    }

    let committed = false;
    let released = false;
    let commitPromise: Promise<void> | null = null;

    return {
      allowed: true,
      count: effectiveCount,
      limit: dailyCheck.limit,
      onFirstModelOutput: () => {
        if (committed) return;
        committed = true;
        commitPromise = incrementDailyMessageCount(userId).catch((err: unknown) => {
          quotaLogger.error("Failed to increment daily message count:", err);
        });
      },
      releaseReservation: async () => {
        if (released) return;
        released = true;
        if (commitPromise) {
          await commitPromise;
        }
        try {
          await redis.decr(key);
        } catch (decrErr: unknown) {
          quotaLogger.error("Failed to decrement Redis in-flight stream counter:", decrErr);
        }
      },
    };
  } catch (err: unknown) {
    try {
      await redis.decr(key);
    } catch (rollbackErr: unknown) {
      quotaLogger.error("Failed to rollback Redis in-flight stream counter:", rollbackErr);
    }
    throw err;
  }
}
