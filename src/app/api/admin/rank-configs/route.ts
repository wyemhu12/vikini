// Admin API route - Rank config management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { invalidateRankConfigsCache } from "@/lib/core/limits";
import { ValidationError, DatabaseError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

const rankConfigsLogger = logger.withContext("AdminRankConfigs");

// ============================================
// Security: Valid ranks whitelist
// ============================================
const VALID_RANKS = ["not_whitelisted", "basic", "pro", "admin"] as const;
type ValidRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is ValidRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as ValidRank);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// GET: List all rank configs
export async function GET() {
  try {
    await requireAdminUser();

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase.from("rank_configs").select("*").order("rank");

    if (dbError) throw new DatabaseError(dbError.message);

    return success({ configs: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to load rank configs", 500);
  }
}

// PATCH: Update rank configs (2-phase: validate all upfront, then write with guaranteed cache invalidation)
export async function PATCH(req: NextRequest) {
  try {
    await requireAdminUser();

    let body: { configs?: unknown };
    try {
      body = (await req.json()) as { configs?: unknown };
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const { configs } = body;
    if (!Array.isArray(configs)) {
      throw new ValidationError("Invalid configs format - expected array");
    }

    const MAX_INT4 = 2147483647;
    const seenRanks = new Set<ValidRank>();
    const validatedUpdates: Array<{ rank: ValidRank; payload: Record<string, unknown> }> = [];

    // Phase 1: Validate every item upfront before performing any DB writes
    for (const config of configs) {
      if (!isPlainObject(config)) {
        throw new ValidationError("Each config entry must be a plain object");
      }

      // SECURITY: Validate rank is in allowed list (prevents SQL injection)
      if (!isValidRank(config.rank)) {
        throw new ValidationError(
          `Invalid rank: ${String(config.rank)}. Must be one of: ${VALID_RANKS.join(", ")}`
        );
      }

      if (seenRanks.has(config.rank)) {
        throw new ValidationError(`Duplicate rank in configs: ${config.rank}`);
      }
      seenRanks.add(config.rank);

      // Validate daily_message_limit: must be integer within [0, 2147483647]
      if (
        typeof config.daily_message_limit !== "number" ||
        !Number.isInteger(config.daily_message_limit) ||
        config.daily_message_limit < 0 ||
        config.daily_message_limit > MAX_INT4
      ) {
        throw new ValidationError(
          "daily_message_limit must be an integer between 0 and 2147483647"
        );
      }

      // Validate max_file_size_mb: must be integer within [0, 2147483647]
      if (
        typeof config.max_file_size_mb !== "number" ||
        !Number.isInteger(config.max_file_size_mb) ||
        config.max_file_size_mb < 0 ||
        config.max_file_size_mb > MAX_INT4
      ) {
        throw new ValidationError("max_file_size_mb must be an integer between 0 and 2147483647");
      }

      // Validate allowed_models when explicitly provided (undefined defaults to [])
      if (
        config.allowed_models !== undefined &&
        (!Array.isArray(config.allowed_models) ||
          !config.allowed_models.every((m) => typeof m === "string"))
      ) {
        throw new ValidationError("allowed_models must be an array of strings");
      }

      // Validate features when explicitly provided
      if (config.features !== undefined && !isPlainObject(config.features)) {
        throw new ValidationError("features must be a plain object");
      }

      validatedUpdates.push({
        rank: config.rank,
        payload: {
          daily_message_limit: config.daily_message_limit,
          max_file_size_mb: config.max_file_size_mb,
          features: config.features,
          allowed_models: (config.allowed_models as string[] | undefined) ?? [],
        },
      });
    }

    const supabase = getSupabaseAdmin();
    let anyWritten = false;

    // Phase 2: Write validated configs and guarantee cache invalidation on any write
    try {
      for (const { rank, payload } of validatedUpdates) {
        const { error: dbError } = await supabase
          .from("rank_configs")
          .update(payload)
          .eq("rank", rank);

        if (dbError) throw new DatabaseError(dbError.message);
        anyWritten = true;
      }
    } finally {
      if (anyWritten) {
        await invalidateRankConfigsCache().catch((cacheErr: unknown) => {
          rankConfigsLogger.warn("Failed to invalidate rank configs cache:", cacheErr);
        });
      }
    }

    return success({ updated: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update rank configs", 500);
  }
}
