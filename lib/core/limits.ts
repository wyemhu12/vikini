// /lib/core/limits.ts
// Centralized limit checking system with Redis caching for rank-based permissions

import { getSupabaseAdmin } from "./supabase";
import { Redis } from "@upstash/redis";

// =====================================================================================
// Types & Interfaces
// =====================================================================================

export interface RankConfig {
  rank: "not_whitelisted" | "basic" | "pro" | "admin";
  daily_message_limit: number;
  max_file_size_mb: number;
  features: {
    web_search: boolean;
    unlimited_gems: boolean;
    [key: string]: boolean;
  };
  allowed_models?: string[];
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
      console.warn("Redis cache read error:", err);
    }
  }

  // Fetch from database
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("rank_configs").select("*").order("rank");

  if (error) {
    throw new Error(`Failed to fetch rank configs: ${error.message}`);
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
      console.warn("Redis cache write error:", err);
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

  if (!config) {
    // Fallback to basic if rank not found
    return (
      configs.get("basic") || {
        rank: "basic",
        daily_message_limit: 20,
        max_file_size_mb: 5,
        features: { web_search: false, unlimited_gems: false },
      }
    );
  }

  return config;
}

// =====================================================================================
// User Profile & Limits Functions
// =====================================================================================

/**
 * Get user profile from database
 */
export async function getUserProfile(userId: string): Promise<{
  id: string;
  email: string;
  rank: string;
  is_blocked: boolean;
} | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Error fetching user profile:", error);
    return null;
  }

  return data as any;
}

/**
 * Get complete user limits (profile + rank config)
 */
export async function getUserLimits(userId: string): Promise<UserLimits> {
  const profile = await getUserProfile(userId);

  if (!profile) {
    // User not found, return basic limits
    const basicConfig = await getRankConfig("basic");
    return {
      userId,
      email: "",
      ...basicConfig,
    };
  }

  if (profile.is_blocked) {
    throw new Error("User is blocked");
  }

  const rankConfig = await getRankConfig(profile.rank);

  return {
    userId,
    email: profile.email,
    ...rankConfig,
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
    console.warn("Error fetching daily message count:", error);
    return 0;
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

  // Read the current count so we can increment instead of resetting to 1
  const currentCount = await getDailyMessageCount(userId);
  const nextCount = currentCount + 1;

  // Upsert the incremented value (creates the row if it doesn't exist yet)
  const { error } = await supabase
    .from("daily_message_counts")
    .upsert(
      {
        user_id: userId,
        date: today,
        count: nextCount,
      },
      {
        onConflict: "user_id,date",
        ignoreDuplicates: false,
      }
    )
    .select();

  if (error) {
    console.warn("Error incrementing message count:", error);
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
// Feature Flag Checking
// =====================================================================================

/**
 * Check if user has access to a specific feature
 */
export async function hasFeature(userId: string, featureName: string): Promise<boolean> {
  const limits = await getUserLimits(userId);
  return limits.features[featureName] === true;
}

/**
 * Check if user has web search enabled
 */
export async function hasWebSearch(userId: string): Promise<boolean> {
  return hasFeature(userId, "web_search");
}

/**
 * Check if user has unlimited gems (can create/edit premade gems)
 */
export async function hasUnlimitedGems(userId: string): Promise<boolean> {
  return hasFeature(userId, "unlimited_gems");
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
      console.warn("Failed to invalidate cache:", err);
    }
  }
}
