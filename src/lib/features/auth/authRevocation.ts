import { getSharedRedis } from "@/lib/core/redis.server";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";

const log = logger.withContext("auth-revocation");

// Redis key: `auth:version:${userId}`
// TTL: 31 days (to outlast the 30-day JWT maxAge)
export const AUTH_VERSION_TTL = 31 * 24 * 60 * 60; // 31 days in seconds

function getRedis() {
  return getSharedRedis();
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

export type RefreshTokenResult =
  | { status: "ok"; rank: string; isBlocked: boolean; userId: string }
  | { status: "not_found" }
  | { status: "error" };

/**
 * Refresh user profile data from database with explicit distinction between
 * found ("ok"), deleted/missing ("not_found"), and transient DB failure ("error").
 */
export async function refreshTokenFromDBDetailed(email: string): Promise<RefreshTokenResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { status: "not_found" };
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
      return { status: "error" };
    }

    if (!profile) {
      return { status: "not_found" };
    }

    // CANONICAL: userId = email (lowercased)
    const userId = cleanEmail;
    const rank = typeof profile.rank === "string" ? profile.rank : "";
    const isBlocked = typeof profile.is_blocked === "boolean" ? profile.is_blocked : false;

    return {
      status: "ok",
      rank,
      isBlocked,
      userId,
    };
  } catch (error: unknown) {
    log.error(`Unexpected error in refreshTokenFromDBDetailed for email ${email}:`, error);
    return { status: "error" };
  }
}

/**
 * Refresh user profile data from database.
 * Returns fresh rank, is_blocked status, and userId (or null when missing/error).
 */
export async function refreshTokenFromDB(
  email: string
): Promise<{ rank: string; isBlocked: boolean; userId: string } | null> {
  const result = await refreshTokenFromDBDetailed(email);
  if (result.status !== "ok") {
    return null;
  }
  return {
    rank: result.rank,
    isBlocked: result.isBlocked,
    userId: result.userId,
  };
}
