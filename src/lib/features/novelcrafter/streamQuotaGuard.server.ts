// /lib/features/novelcrafter/streamQuotaGuard.server.ts
// Serverless-safe daily message quota reservation using Upstash Redis (NC-06, Q2, R1)

import { checkDailyMessageLimit, incrementDailyMessageCount } from "@/lib/core/limits";
import { getSharedRedis } from "@/lib/core/redis.server";
import { AccessPendingError, AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const quotaLogger = logger.withContext("streamQuotaGuard");

const INFLIGHT_KEY_PREFIX = "nc-stream-inflight";
const INFLIGHT_TTL_SECONDS = 360;
const DECR_AND_CLEANUP_LUA =
  "local v = redis.call('DECR', KEYS[1]); if v <= 0 then redis.call('DEL', KEYS[1]); return 0; end; return v;";

const localInFlightCounts = new Map<string, number>();

export function resetLocalInFlightQuotaForTests(): void {
  localInFlightCounts.clear();
}

function buildInFlightKey(userId: string): string {
  const utcDate = new Date().toISOString().slice(0, 10);
  return `${INFLIGHT_KEY_PREFIX}:${userId}:${utcDate}`;
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
  const redis = getSharedRedis();
  const key = buildInFlightKey(userId);

  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("Quota service temporarily unavailable", 503, "QUOTA_SERVICE_UNAVAILABLE");
    }

    const decrLocalInFlight = () => {
      const nextVal = Math.max(0, (localInFlightCounts.get(key) ?? 1) - 1);
      if (nextVal === 0) localInFlightCounts.delete(key);
      else localInFlightCounts.set(key, nextVal);
    };

    const currentInFlight = (localInFlightCounts.get(key) ?? 0) + 1;
    localInFlightCounts.set(key, currentInFlight);

    try {
      const dailyCheck = await checkDailyMessageLimit(userId);
      if (dailyCheck.rank === "not_whitelisted") {
        throw new AccessPendingError();
      }

      const effectiveCount = dailyCheck.count + currentInFlight;
      if (!dailyCheck.canSend || effectiveCount > dailyCheck.limit) {
        decrLocalInFlight();
        return {
          allowed: false,
          count: Math.max(dailyCheck.count, effectiveCount - 1),
          limit: dailyCheck.limit,
        };
      }

      let committed = false;
      let inFlightReleased = false;
      let commitPromise: Promise<void> | null = null;

      const releaseInFlightOnce = () => {
        if (inFlightReleased) return;
        inFlightReleased = true;
        decrLocalInFlight();
      };

      return {
        allowed: true,
        count: effectiveCount,
        limit: dailyCheck.limit,
        onFirstModelOutput: () => {
          if (committed) return;
          committed = true;
          commitPromise = Promise.resolve()
            .then(() => incrementDailyMessageCount(userId))
            .catch((err: unknown) => {
              quotaLogger.error("Failed to increment daily message count:", err);
            })
            .finally(() => {
              releaseInFlightOnce();
            });
        },
        releaseReservation: async () => {
          if (commitPromise) {
            await commitPromise;
          }
          releaseInFlightOnce();
        },
      };
    } catch (err: unknown) {
      decrLocalInFlight();
      throw err;
    }
  }

  // Step 1: Execute redis.incr(key) OUTSIDE try-catch so a failed incr never triggers decr
  const inFlight = await redis.incr(key);

  try {
    if (inFlight === 1) {
      await redis.expire(key, INFLIGHT_TTL_SECONDS);
    } else {
      await redis.expire(key, INFLIGHT_TTL_SECONDS, "NX");
    }

    const dailyCheck = await checkDailyMessageLimit(userId);
    if (dailyCheck.rank === "not_whitelisted") {
      throw new AccessPendingError();
    }

    const effectiveCount = dailyCheck.count + inFlight;

    if (!dailyCheck.canSend || effectiveCount > dailyCheck.limit) {
      await redis.eval(DECR_AND_CLEANUP_LUA, [key], []);
      return {
        allowed: false,
        count: Math.max(dailyCheck.count, effectiveCount - 1),
        limit: dailyCheck.limit,
      };
    }

    let committed = false;
    let releasePromise: Promise<void> | null = null;
    let commitPromise: Promise<void> | null = null;

    const releaseInFlightOnce = (): Promise<void> => {
      if (!releasePromise) {
        releasePromise = (async () => {
          try {
            await redis.eval(DECR_AND_CLEANUP_LUA, [key], []);
          } catch (decrErr: unknown) {
            quotaLogger.error("Failed to decrement Redis in-flight stream counter:", decrErr);
          }
        })();
      }
      return releasePromise;
    };

    return {
      allowed: true,
      count: effectiveCount,
      limit: dailyCheck.limit,
      onFirstModelOutput: () => {
        if (committed) return;
        committed = true;
        commitPromise = Promise.resolve()
          .then(() => incrementDailyMessageCount(userId))
          .catch((err: unknown) => {
            quotaLogger.error("Failed to increment daily message count:", err);
          })
          .finally(() => releaseInFlightOnce());
      },
      releaseReservation: async () => {
        if (commitPromise) {
          await commitPromise;
        }
        await releaseInFlightOnce();
      },
    };
  } catch (err: unknown) {
    try {
      await redis.eval(DECR_AND_CLEANUP_LUA, [key], []);
    } catch (rollbackErr: unknown) {
      quotaLogger.error("Failed to rollback Redis in-flight stream counter:", rollbackErr);
    }
    throw err;
  }
}
