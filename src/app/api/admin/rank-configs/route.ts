// Admin API route - Rank config management
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { invalidateRankConfigsCache } from "@/lib/core/limits";
import { ForbiddenError, ValidationError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

// ============================================
// Security: Valid ranks whitelist
// ============================================
const VALID_RANKS = ["not_whitelisted", "basic", "pro", "admin"] as const;
type ValidRank = (typeof VALID_RANKS)[number];

function isValidRank(rank: unknown): rank is ValidRank {
  return typeof rank === "string" && VALID_RANKS.includes(rank as ValidRank);
}

// GET: List all rank configs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase.from("rank_configs").select("*").order("rank");

    if (dbError) throw new Error(dbError.message);

    return success({ configs: data });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to load rank configs", 500);
  }
}

// PATCH: Update rank configs
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.rank !== "admin") {
      throw new ForbiddenError("Admin access required");
    }

    const body = (await req.json()) as { configs?: unknown };
    const { configs } = body;

    if (!Array.isArray(configs)) {
      throw new ValidationError("Invalid configs format - expected array");
    }

    const supabase = getSupabaseAdmin();

    const MAX_INT4 = 2147483647;

    // Update each config with validation
    for (const config of configs) {
      const configObj = config as {
        rank?: string;
        daily_message_limit?: unknown;
        max_file_size_mb?: unknown;
        daily_research_limit?: unknown;
        features?: unknown;
        allowed_models?: string[];
      };

      // SECURITY: Validate rank is in allowed list (prevents SQL injection)
      if (!isValidRank(configObj.rank)) {
        throw new ValidationError(
          `Invalid rank: ${configObj.rank}. Must be one of: ${VALID_RANKS.join(", ")}`
        );
      }

      // Validate daily_message_limit: must be integer within [0, 2147483647]
      if (
        typeof configObj.daily_message_limit !== "number" ||
        !Number.isInteger(configObj.daily_message_limit) ||
        configObj.daily_message_limit < 0 ||
        configObj.daily_message_limit > MAX_INT4
      ) {
        throw new ValidationError(
          "daily_message_limit must be an integer between 0 and 2147483647"
        );
      }

      // Validate max_file_size_mb: must be integer within [0, 2147483647]
      if (
        typeof configObj.max_file_size_mb !== "number" ||
        !Number.isInteger(configObj.max_file_size_mb) ||
        configObj.max_file_size_mb < 0 ||
        configObj.max_file_size_mb > MAX_INT4
      ) {
        throw new ValidationError("max_file_size_mb must be an integer between 0 and 2147483647");
      }

      const updatePayload: Record<string, unknown> = {
        daily_message_limit: configObj.daily_message_limit,
        max_file_size_mb: configObj.max_file_size_mb,
        features: configObj.features,
        allowed_models: configObj.allowed_models || [],
      };

      // Validate optional daily_research_limit
      if (configObj.daily_research_limit !== undefined) {
        if (
          typeof configObj.daily_research_limit !== "number" ||
          !Number.isInteger(configObj.daily_research_limit) ||
          configObj.daily_research_limit < 0 ||
          configObj.daily_research_limit > MAX_INT4
        ) {
          throw new ValidationError(
            "daily_research_limit must be an integer between 0 and 2147483647"
          );
        }
        updatePayload.daily_research_limit = configObj.daily_research_limit;
      }

      const { error: dbError } = await supabase
        .from("rank_configs")
        .update(updatePayload)
        .eq("rank", configObj.rank);

      if (dbError) throw new Error(dbError.message);
    }

    // Invalidate cache so new configs take effect immediately
    await invalidateRankConfigsCache();

    return success({ updated: true });
  } catch (err: unknown) {
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Failed to update rank configs", 500);
  }
}
