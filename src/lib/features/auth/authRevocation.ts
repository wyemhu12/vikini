import { Redis } from "@upstash/redis";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";

const log = logger.withContext("auth-revocation");

// Redis key: `auth:version:${userId}`
// TTL: 31 days (to outlast the 30-day JWT maxAge)
export const AUTH_VERSION_TTL = 31 * 24 * 60 * 60; // 31 days in seconds

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      log.warn(
        "Redis cache not available: missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
      );
      return null;
    }

    try {
      redis = new Redis({ url, token });
    } catch (error: unknown) {
      log.error("Failed to initialize Redis cache:", error);
      return null;
    }
  }
  return redis;
}

/**
 * Bump the auth version for a user. Call this when admin changes rank or blocks a user.
 * Sets Redis key `auth:version:${userId}` = current timestamp.
 */
export async function bumpAuthVersion(userId: string): Promise<void> {
  const r = getRedis();
  if (!r) {
    log.warn(`Skipping bumpAuthVersion for user ${userId}: Redis is not available`);
    return;
  }

  try {
    const timestamp = Date.now();
    const key = `auth:version:${userId}`;
    await r.setex(key, AUTH_VERSION_TTL, timestamp);
    log.info(`Successfully bumped auth version for user ${userId} to ${timestamp}`);
  } catch (error: unknown) {
    log.error(`Failed to bump auth version for user ${userId}:`, error);
  }
}

/**
 * Get the auth version for a user from Redis.
 * Returns the timestamp number, or null if Redis unavailable or key doesn't exist.
 */
export async function getAuthVersion(userId: string): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const key = `auth:version:${userId}`;
    const version = await r.get<number | string>(key);
    if (version === null || version === undefined) {
      return null;
    }

    if (typeof version === "number") {
      return version;
    }

    if (typeof version === "string") {
      const parsed = Number(version);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  } catch (error: unknown) {
    log.error(`Failed to get auth version for user ${userId}:`, error);
    return null;
  }
}

/**
 * Refresh user profile data from database.
 * Returns fresh rank, is_blocked status, and userId.
 */
export async function refreshTokenFromDB(
  email: string
): Promise<{ rank: string; isBlocked: boolean; userId: string } | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return null;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, rank, is_blocked")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      log.error(`Failed to query user profile by email ${cleanEmail}:`, error);
      return null;
    }

    if (!profile) {
      return null;
    }

    // CANONICAL: userId = email (lowercased)
    const userId = cleanEmail;
    const rank = typeof profile.rank === "string" ? profile.rank : "";
    const isBlocked = typeof profile.is_blocked === "boolean" ? profile.is_blocked : false;

    if (!userId) {
      log.warn(`Profile for email ${cleanEmail} has missing or invalid id`);
      return null;
    }

    return {
      rank,
      isBlocked,
      userId,
    };
  } catch (error: unknown) {
    log.error(`Unexpected error in refreshTokenFromDB for email ${email}:`, error);
    return null;
  }
}
