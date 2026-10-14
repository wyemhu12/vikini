// /lib/core/limits.ts
// Centralized limit checking system with Redis caching for rank-based permissions

import { getSupabaseAdmin } from "./supabase.server";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";
import { ForbiddenError, ServiceUnavailableError, UserBlockedError } from "@/lib/utils/errors";
import { DEFAULT_MODEL, normalizeModelForApi, coerceStoredModel } from "./modelRegistry";
import { MODEL_IDS } from "@/lib/utils/constants";

const limitsLogger = logger.withContext("limits");

// =====================================================================================
// Types & Interfaces
// =====================================================================================

export interface RankConfig {
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  daily_message_limit: number;
  daily_research_limit: number;
  max_file_size_mb: number;
  features: {
    web_search: boolean;
    unlimited_gems: boolean;
    deep_research: boolean;
    [key: string]: boolean;
  };
  allowed_models?: string[];
}

export type UserRank = RankConfig["rank"];

export interface UserProfile {
  id: string;
  email: string;
  rank: string;
  is_blocked: boolean;
}

export interface UserLimits extends RankConfig {
  userId: string;
  email: string;
}

export interface DailyMessageStatus {
  count: number;
  limit: number;
  remaining: number;
  canSend: boolean;
  rank: string;
}

// =====================================================================================
// Redis Cache Setup
// =====================================================================================

let redis: Redis | null = null;

function getRedisOptional(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/** Ranks of approved users. Anything else is treated as unapproved. */
const APPROVED_RANKS: ReadonlySet<string> = new Set(["basic", "pro", "admin"]);

/** Used when an approved rank's config row is missing (keeps approved users working). */
const BASIC_FALLBACK_CONFIG: RankConfig = {
  rank: "basic",
  daily_message_limit: 20,
  daily_research_limit: 0,
  max_file_size_mb: 5,
  features: { web_search: false, unlimited_gems: false, deep_research: false },
  allowed_models: [DEFAULT_MODEL],
};

/**
 * Used for unapproved / unknown ranks when no config row exists, and for missing profiles.
 * Denies everything (fail-closed).
 */
const DENY_CONFIG: RankConfig = {
  rank: "not_whitelisted",
  daily_message_limit: 0,
  daily_research_limit: 0,
  max_file_size_mb: 0,
  features: { web_search: false, unlimited_gems: false, deep_research: false },
  allowed_models: [],
};

const RANK_CONFIGS_CACHE_KEY = "rank_configs:all";
const RANK_CONFIGS_TTL_SECONDS = 5 * 60; // 5 minutes

// =====================================================================================
// Rank Config Functions (with caching)
// =====================================================================================

/**
 * Get all rank configurations from cache or database
 */
async function getRankConfigs(): Promise<Map<string, RankConfig>> {
  const r = getRedisOptional();

  // Try cache first
  if (r) {
    try {
      const cached = await r.get<RankConfig[]>(RANK_CONFIGS_CACHE_KEY);
      if (cached && Array.isArray(cached)) {
        const map = new Map<string, RankConfig>();
        for (const config of cached) {
          map.set(config.rank, config);
        }
        return map;
      }
    } catch (err) {
      limitsLogger.warn("Redis cache read error:", err);
    }
  }

  // Fetch from database
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("rank_configs").select("*").order("rank");

  if (error) {
    limitsLogger.error("Failed to fetch rank configs:", error);
    throw new ServiceUnavailableError("Unable to load rank configuration");
  }

  const configs = (data || []) as RankConfig[];
  const map = new Map<string, RankConfig>();

  for (const config of configs) {
    map.set(config.rank, config);
  }

  // Cache for next time
  if (r && configs.length > 0) {
    try {
      await r.setex(RANK_CONFIGS_CACHE_KEY, RANK_CONFIGS_TTL_SECONDS, configs);
    } catch (err) {
      limitsLogger.warn("Redis cache write error:", err);
    }
  }

  return map;
}

/**
 * Get rank config for a specific rank
 */
export async function getRankConfig(rank: string): Promise<RankConfig> {
  const configs = await getRankConfigs();
  const config = configs.get(rank);

  if (config) return config;

  // Approved ranks fall back to basic; unapproved/unknown ranks are denied (never basic).
  if (APPROVED_RANKS.has(rank)) {
    limitsLogger.warn(`Rank config missing for "${rank}", falling back to basic`);
    return configs.get("basic") || BASIC_FALLBACK_CONFIG;
  }
  if (rank !== "not_whitelisted") {
    limitsLogger.error(`Unknown rank "${rank}", denying access`);
  }
  return DENY_CONFIG;
}

// =====================================================================================
// User Profile & Limits Functions
// =====================================================================================

/**
 * Get user profile from database (fail-closed).
 * userId is the canonical email (lowercased) after normalization.
 * @returns the profile, or null only when no row exists
 * @throws ServiceUnavailableError when the database query fails
 */
export async function getUserProfileStrict(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseAdmin();

  // CANONICAL: userId = email, so query by email directly
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", userId)
    .maybeSingle();

  if (error) {
    limitsLogger.error("Error fetching user profile by email:", error);
    throw new ServiceUnavailableError("Unable to verify user profile");
  }

  return data as UserProfile | null;
}

/**
 * Get user profile from database.
 * @returns the profile, or null when missing OR when the query fails —
 *   callers must treat null as "deny" (see image routes' 503 handling)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    return await getUserProfileStrict(userId);
  } catch {
    return null;
  }
}

/**
 * Get complete user limits (profile + rank config). Fail-closed:
 * - missing profile → deny-all limits (rank "not_whitelisted")
 * - blocked → UserBlockedError
 * - database error → ServiceUnavailableError
 */
export async function getUserLimits(userId: string): Promise<UserLimits> {
  const profile = await getUserProfileStrict(userId);

  if (!profile) {
    return { ...DENY_CONFIG, userId, email: "" };
  }

  if (profile.is_blocked) {
    throw new UserBlockedError();
  }

  const rankConfig = await getRankConfig(profile.rank);

  return {
    ...rankConfig,
    userId,
    email: profile.email,
    // Rank always comes from the profile, never from the (possibly fallback) config row
    rank: APPROVED_RANKS.has(profile.rank) ? (profile.rank as UserRank) : "not_whitelisted",
  };
}

// =====================================================================================
// Daily Message Count Functions
// =====================================================================================

/**
 * Get current daily message count for user
 */
export async function getDailyMessageCount(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from("daily_message_counts")
    .select("count")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    limitsLogger.error("Error fetching daily message count:", error);
    throw new ServiceUnavailableError("Unable to verify daily message quota");
  }

  return data?.count || 0;
}

/**
 * Check if user can send a message (within daily limit)
 */
export async function checkDailyMessageLimit(userId: string): Promise<DailyMessageStatus> {
  const limits = await getUserLimits(userId);
  const count = await getDailyMessageCount(userId);

  return {
    count,
    limit: limits.daily_message_limit,
    remaining: Math.max(0, limits.daily_message_limit - count),
    canSend: count < limits.daily_message_limit,
    rank: limits.rank,
  };
}

/**
 * Increment daily message count for user
 */
export async function incrementDailyMessageCount(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Use RPC for atomic increment
  const { error } = await supabase.rpc("increment_daily_message_count", {
    p_user_id: userId,
    p_date: today,
  });

  if (error) {
    limitsLogger.warn("Error incrementing message count:", error);
  }
}

// =====================================================================================
// File Size Validation
// =====================================================================================

/**
 * Check if file size is within user's limit
 */
export async function checkFileSize(
  userId: string,
  fileSizeBytes: number
): Promise<{ allowed: boolean; maxSizeMB: number; fileSizeMB: number }> {
  const limits = await getUserLimits(userId);
  const maxBytes = limits.max_file_size_mb * 1024 * 1024;
  const fileSizeMB = Math.round((fileSizeBytes / 1024 / 1024) * 100) / 100;

  return {
    allowed: fileSizeBytes <= maxBytes,
    maxSizeMB: limits.max_file_size_mb,
    fileSizeMB,
  };
}

// =====================================================================================
// Daily Research Count Functions
// =====================================================================================

/**
 * Get current daily research count for user
 */
export async function getResearchDailyCount(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from("daily_research_counts")
    .select("count")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    limitsLogger.error("Error fetching daily research count:", error);
    throw new ServiceUnavailableError("Unable to verify daily research quota");
  }

  return data?.count || 0;
}

/**
 * Atomically claims one research slot for the user.
 * Increments the counter first, then verifies the new count is within the limit.
 * If over the limit the increment is rolled back and false is returned.
 *
 * This eliminates the TOCTOU race that existed when canDoResearch() and
 * incrementResearchCount() were called in two separate non-atomic steps (BUG-02).
 *
 * @returns true if the slot was successfully claimed; false if not allowed or over limit.
 */
export async function tryClaimResearchSlot(userId: string): Promise<boolean> {
  const limits = await getUserLimits(userId);

  if (!limits.features.deep_research) return false;

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0];

  // 1. Atomic increment via RPC (upsert with count + 1)
  const { error: rpcError } = await supabase.rpc("increment_daily_research_count", {
    p_user_id: userId,
    p_date: today,
  });

  if (rpcError) {
    // RPC failed - fall back to read-then-write. Not perfectly atomic but best effort.
    limitsLogger.warn("RPC increment failed, falling back to manual increment:", rpcError);
    const currentCount = await getResearchDailyCount(userId);
    const { error: upsertError } = await supabase
      .from("daily_research_counts")
      .upsert(
        { user_id: userId, date: today, count: currentCount + 1 },
        { onConflict: "user_id,date" }
      );
    if (upsertError) {
      limitsLogger.error("Fallback research count increment failed:", upsertError);
      throw new ServiceUnavailableError("Unable to record research usage");
    }
  }

  // 2. Read back the current count after increment
  const newCount = await getResearchDailyCount(userId);

  // 3. If over limit, roll back the increment and deny the request
  if (newCount > limits.daily_research_limit) {
    const { error: rollbackError } = await supabase
      .from("daily_research_counts")
      .update({ count: Math.max(0, newCount - 1) })
      .eq("user_id", userId)
      .eq("date", today);

    if (rollbackError) {
      limitsLogger.warn("Failed to rollback research count increment:", rollbackError);
    }
    return false;
  }

  return true;
}

// =====================================================================================
// Conversation Storage Limit (Rank-Based)
// =====================================================================================

const CONVERSATION_STORAGE_MULTIPLIER = 5;

/**
 * Get max total bytes allowed per conversation based on user's rank.
 * Derived from rank's max_file_size_mb × multiplier.
 * If env var ATTACH_MAX_TOTAL_BYTES_PER_CONV is set, it acts as an absolute override.
 */
export async function getConversationStorageLimit(userId: string): Promise<number> {
  const envOverride = process.env.ATTACH_MAX_TOTAL_BYTES_PER_CONV;
  if (envOverride) {
    const n = Number(envOverride);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }

  const limits = await getUserLimits(userId);
  return limits.max_file_size_mb * CONVERSATION_STORAGE_MULTIPLIER * 1024 * 1024;
}

// =====================================================================================
// Cache Invalidation
// =====================================================================================

/**
 * Invalidate rank configs cache (call when admin updates configs)
 */
export async function invalidateRankConfigsCache(): Promise<void> {
  const r = getRedisOptional();
  if (r) {
    try {
      await r.del(RANK_CONFIGS_CACHE_KEY);
    } catch (err) {
      limitsLogger.warn("Failed to invalidate cache:", err);
    }
  }
}

// =====================================================================================
// Model Rank Gating
// =====================================================================================

/**
 * Check whether a user's rank permits using the specified model.
 * Fails closed (throws ServiceUnavailableError / UserBlockedError) if limits cannot be verified.
 */
export async function isModelAllowedForUser(userId: string, model: string): Promise<boolean> {
  const limits = await getUserLimits(userId);
  if (limits.rank === "not_whitelisted") {
    return false;
  }
  const normalizedModel = normalizeModelForApi(model);
  if (normalizedModel === MODEL_IDS.IMAGE_STUDIO || normalizedModel === MODEL_IDS.NOVELCRAFTER) {
    return true;
  }
  const coercedModel = coerceStoredModel(model);
  const allowedList = limits.allowed_models ?? [];
  const allowedSet = new Set(
    allowedList.flatMap((m) => [m, normalizeModelForApi(m), coerceStoredModel(m)])
  );
  return allowedSet.has(model) || allowedSet.has(normalizedModel) || allowedSet.has(coercedModel);
}

/**
 * Enforce rank-based model access on the server.
 * Throws ForbiddenError (403) if the user's rank is not permitted to use the model.
 */
export async function assertModelAllowedForUser(userId: string, model: string): Promise<void> {
  const limits = await getUserLimits(userId);
  if (limits.rank === "not_whitelisted") {
    throw new ForbiddenError("User account is not approved to access AI models");
  }
  const normalizedModel = normalizeModelForApi(model);
  if (normalizedModel === MODEL_IDS.IMAGE_STUDIO || normalizedModel === MODEL_IDS.NOVELCRAFTER) {
    return;
  }
  const coercedModel = coerceStoredModel(model);
  const allowedList = limits.allowed_models ?? [];
  const allowedSet = new Set(
    allowedList.flatMap((m) => [m, normalizeModelForApi(m), coerceStoredModel(m)])
  );
  if (!allowedSet.has(model) && !allowedSet.has(normalizedModel) && !allowedSet.has(coercedModel)) {
    throw new ForbiddenError(`Model "${normalizedModel}" is not allowed for rank "${limits.rank}"`);
  }
}
