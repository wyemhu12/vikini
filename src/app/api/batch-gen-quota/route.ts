import { auth } from "@/lib/features/auth/auth";
import { getUserProfileStrict } from "@/lib/core/limits";
import { logger } from "@/lib/utils/logger";
import { UnauthorizedError, AppError, UserBlockedError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { getRedis, BATCH_GEN_LIMITS, type BatchGenLimitConfig } from "@/lib/core/batchGenQuota";

const routeLogger = logger.withContext("batch-gen-quota");

export async function GET() {
  try {
    // 1. Auth Check
    const session = await auth();
    if (!session?.user?.email) {
      throw new UnauthorizedError();
    }
    const userId = session.user.email.toLowerCase();

    // 2. Get user rank
    const profile = await getUserProfileStrict(userId);
    if (profile?.is_blocked) throw new UserBlockedError();
    // Missing profile or unknown rank gets the most restrictive tier, never basic
    const rank = profile && profile.rank in BATCH_GEN_LIMITS ? profile.rank : "not_whitelisted";
    const config: BatchGenLimitConfig = BATCH_GEN_LIMITS[rank];

    // 3. Get today's usage from Redis per batch size
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const redis = getRedis();

    const quotas: Record<string, { limit: number; used: number; remaining: number }> = {};

    for (const [batchSizeStr, limit] of Object.entries(config.quotas)) {
      const batchSize = Number(batchSizeStr);
      let used = 0;

      if (redis) {
        try {
          const key = `batch-gen:${userId}:${today}:${batchSize}`;
          const count = await redis.get<number>(key);
          used = count || 0;
        } catch (err: unknown) {
          routeLogger.warn(`Redis error for batch size ${batchSize}:`, err);
        }
      }

      quotas[batchSizeStr] = {
        limit,
        used,
        remaining: Math.max(0, limit - used),
      };
    }

    return success({
      rank,
      maxBatchSize: config.maxBatchSize,
      quotas,
    });
  } catch (err: unknown) {
    routeLogger.error("Batch Gen Quota Route Error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to fetch batch generation quota", 500);
  }
}
